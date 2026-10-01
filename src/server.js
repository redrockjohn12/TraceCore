require('dotenv').config();
const express=require('express');
const crypto=require('crypto');
const path=require('path');
const {DatabaseSync}=require('node:sqlite');

const app=express();
const PORT=Number(process.env.PORT||3000);
const APP_URL=(process.env.APP_URL||`http://127.0.0.1:${PORT}`).replace(/\/$/,'');
const dbPath=path.join(__dirname,'..','data','tracecore.db');
const fs=require('fs'); fs.mkdirSync(path.dirname(dbPath),{recursive:true});
const db=new DatabaseSync(dbPath);

app.disable('x-powered-by');
app.set('trust proxy',1);
app.use(express.json({limit:'1mb'}));
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');next();});
app.use((req,res,next)=>{if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization, X-Device-Token');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');res.status(204).end();return;} next();});

function hasColumn(table,col){return db.prepare(`PRAGMA table_info(${table})`).all().some(x=>x.name===col)}
function addColumn(table,col,definition){if(!hasColumn(table,col))db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${definition}`)}
function migrate(){
 db.exec(`PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'customer',created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,token_hash TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,expires_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS subscriptions(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,plan TEXT NOT NULL,price_minor INTEGER NOT NULL,currency TEXT NOT NULL,status TEXT NOT NULL,provider TEXT,payment_status TEXT,provider_subscription_id TEXT,started_at TEXT,expires_at TEXT);
 CREATE TABLE IF NOT EXISTS devices(id INTEGER PRIMARY KEY AUTOINCREMENT,recovery_id TEXT NOT NULL UNIQUE,user_id INTEGER NOT NULL,device_name TEXT NOT NULL,platform TEXT,manufacturer TEXT,model TEXT,serial_number TEXT,imei TEXT,management_mode TEXT,enrollment_state TEXT,status TEXT NOT NULL DEFAULT 'protected',registered_at TEXT,last_seen_at TEXT,device_token_hash TEXT);
 CREATE TABLE IF NOT EXISTS locations(id INTEGER PRIMARY KEY AUTOINCREMENT,device_id INTEGER NOT NULL,latitude REAL NOT NULL,longitude REAL NOT NULL,accuracy REAL,timestamp TEXT NOT NULL,source TEXT);
 CREATE TABLE IF NOT EXISTS security_events(id INTEGER PRIMARY KEY AUTOINCREMENT,device_id INTEGER NOT NULL,event_type TEXT NOT NULL,details TEXT,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS family_members(id INTEGER PRIMARY KEY AUTOINCREMENT,owner_user_id INTEGER NOT NULL,member_user_id INTEGER NOT NULL,created_at TEXT NOT NULL,UNIQUE(owner_user_id,member_user_id));
 CREATE TABLE IF NOT EXISTS family_invites(id INTEGER PRIMARY KEY AUTOINCREMENT,owner_user_id INTEGER NOT NULL,email TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL,accepted_at TEXT);
 CREATE TABLE IF NOT EXISTS payment_orders(id INTEGER PRIMARY KEY AUTOINCREMENT,provider TEXT NOT NULL,provider_order_id TEXT NOT NULL UNIQUE,user_id INTEGER NOT NULL,plan TEXT NOT NULL,amount_minor INTEGER NOT NULL,currency TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,captured_at TEXT);
 CREATE TABLE IF NOT EXISTS admin_audit_logs(id INTEGER PRIMARY KEY AUTOINCREMENT,admin_user_id INTEGER NOT NULL,action TEXT NOT NULL,target_type TEXT,target_id TEXT,details TEXT,created_at TEXT NOT NULL);
 `);
 addColumn('users','role',"TEXT NOT NULL DEFAULT 'customer'");
 addColumn('devices','device_token_hash','TEXT');
}
migrate();

const PLANS={
 personal:{name:'Personal',priceMinor:10000,currency:'ZAR',maxDevices:1},
 family:{name:'Family',priceMinor:30000,currency:'ZAR',maxDevices:5},
 family_plus:{name:'Family Plus',priceMinor:75000,currency:'ZAR',maxDevices:10},
 business_starter:{name:'Business Starter',priceMinor:150000,currency:'ZAR',maxDevices:25},
 business:{name:'Business',priceMinor:250000,currency:'ZAR',maxDevices:50},
 business_plus:{name:'Business Plus',priceMinor:500000,currency:'ZAR',maxDevices:100}
};
const now=()=>new Date().toISOString();
const hash=s=>crypto.createHash('sha256').update(String(s)).digest('hex');
const token=()=>crypto.randomBytes(32).toString('hex');
function passwordHash(password){const salt=crypto.randomBytes(16).toString('hex');const key=crypto.scryptSync(password,salt,64).toString('hex');return `scrypt:${salt}:${key}`}
function passwordOK(password,stored){try{const [,salt,key]=String(stored).split(':');const got=crypto.scryptSync(password,salt,64).toString('hex');return crypto.timingSafeEqual(Buffer.from(got,'hex'),Buffer.from(key,'hex'))}catch{return false}}
function user(id){return db.prepare('SELECT id,name,email,role,created_at FROM users WHERE id=?').get(id)}
function directSub(id){return db.prepare("SELECT * FROM subscriptions WHERE user_id=? AND status='active' AND expires_at>? ORDER BY id DESC LIMIT 1").get(id,now())||null}
function ownerId(id){const r=db.prepare('SELECT owner_user_id FROM family_members WHERE member_user_id=? LIMIT 1').get(id);return r?.owner_user_id||id}
function subFor(id){return directSub(id)||((ownerId(id)!==id)?directSub(ownerId(id)):null)}
function planFor(id){const s=subFor(id);return s?PLANS[s.plan]:null}
function accessibleIds(id){const root=ownerId(id);const rows=db.prepare('SELECT member_user_id FROM family_members WHERE owner_user_id=?').all(root);return [root,...rows.map(r=>r.member_user_id)];}
function devicesFor(id){const ids=accessibleIds(id);const qs=ids.map(()=>'?').join(',');return db.prepare(`SELECT d.*,u.name owner_name FROM devices d JOIN users u ON u.id=d.user_id WHERE d.user_id IN (${qs}) ORDER BY d.id DESC`).all(...ids)}
function getDevice(id,recoveryId){const ids=accessibleIds(id);const qs=ids.map(()=>'?').join(',');return db.prepare(`SELECT * FROM devices WHERE recovery_id=? AND user_id IN (${qs})`).get(recoveryId,...ids)}
function activate(id,planId,provider='manual',providerId=null){const p=PLANS[planId],start=new Date(),end=new Date(Date.now()+31*86400000);db.prepare("UPDATE subscriptions SET status='cancelled',payment_status='replaced' WHERE user_id=? AND status='active'").run(id);db.prepare(`INSERT INTO subscriptions(user_id,plan,price_minor,currency,status,provider,payment_status,provider_subscription_id,started_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(id,planId,p.priceMinor,p.currency,'active',provider,'paid',providerId,start.toISOString(),end.toISOString());return directSub(id)}

function provisionInitialAdmin(){
  const email=String(process.env.TRACECORE_ADMIN_EMAIL||'').trim().toLowerCase();

  if(!email)return;

  let u=db.prepare('SELECT * FROM users WHERE email=?').get(email);

  if(!u){
    const password=String(process.env.TRACECORE_ADMIN_PASSWORD||'');

    if(password.length<12){
      console.error('TRACECORE_ADMIN_PASSWORD must be at least 12 characters when creating the initial admin.');
      return;
    }

    const r=db.prepare(
      'INSERT INTO users(name,email,password_hash,role,created_at) VALUES(?,?,?,?,?)'
    ).run(
      'TraceCore Administrator',
      email,
      passwordHash(password),
      'admin',
      now()
    );

    u=db.prepare('SELECT * FROM users WHERE id=?').get(r.lastInsertRowid);

    console.log('Initial TraceCore admin account created.');
  }else{
    if(u.role!=='admin'){
      db.prepare('UPDATE users SET role=? WHERE id=?').run('admin',u.id);
      console.log('Existing TraceCore account promoted to admin role.');
    }
  }

  const active=directSub(u.id);

  if(!active || active.plan!=='business'){
    const previousPlan=active ? active.plan : 'none';

    activate(u.id,'business','system_admin');

    console.log(
      `Admin Business plan provisioned. Previous plan: ${previousPlan}.`
    );
  }
}

provisionInitialAdmin();
function requireSub(req,res,next){const s=subFor(req.user.id);if(!s)return res.status(402).json({error:'An active subscription is required'});req.subscription=s;req.plan=PLANS[s.plan];req.subscriptionOwnerId=ownerId(req.user.id);next()}
function auth(req,res,next){const h=req.headers.authorization||'';const raw=h.startsWith('Bearer ')?h.slice(7):'';if(!raw)return res.status(401).json({error:'Authentication required'});const s=db.prepare('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?').get(hash(raw),now());if(!s)return res.status(401).json({error:'Session expired or invalid'});req.user=user(s.user_id);if(!req.user)return res.status(401).json({error:'User not found'});req.session=s;next()}

function adminAuth(req,res,next){
  auth(req,res,()=>{
    if(req.user.role!=='admin'){
      return res.status(403).json({error:'Administrator access required'});
    }
    next();
  });
}

function adminAudit(adminId,action,targetType,targetId,details={}){
  db.prepare(`
    INSERT INTO admin_audit_logs
    (admin_user_id,action,target_type,target_id,details,created_at)
    VALUES(?,?,?,?,?,?)
  `).run(
    adminId,
    action,
    targetType||null,
    targetId==null?null:String(targetId),
    JSON.stringify(details),
    now()
  );
}
function deviceAuth(req,res,next){const raw=req.headers['x-device-token']||req.body?.deviceToken||'';if(!raw)return res.status(401).json({error:'Device token required'});const d=db.prepare('SELECT * FROM devices WHERE device_token_hash=?').get(hash(raw));if(!d)return res.status(401).json({error:'Invalid device token'});d.last_seen_at=now();db.prepare('UPDATE devices SET last_seen_at=? WHERE id=?').run(d.last_seen_at,d.id);req.device=d;next()}
const rateMap=new Map();
function rate(req,res,next){const key=`${req.ip}:${req.path}`;const t=Date.now(),a=rateMap.get(key)||[];const b=a.filter(x=>t-x<60000);if(b.length>30)return res.status(429).json({error:'Too many requests'});b.push(t);rateMap.set(key,b);next()}
app.use('/api/',rate);
app.get('/api/health',(req,res)=>res.json({ok:true,service:'TraceCore',version:'10.1.0',time:now()}));
app.get('/api/plans',(req,res)=>res.json({plans:Object.entries(PLANS).map(([id,p])=>({id,...p,price:p.priceMinor/100}))}));

app.post('/api/auth/register',(req,res)=>{const name=String(req.body.name||'').trim(),email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');if(name.length<2||!email.includes('@')||password.length<8)return res.status(400).json({error:'Name, valid email and password of at least 8 characters are required'});try{const r=db.prepare('INSERT INTO users(name,email,password_hash,created_at) VALUES(?,?,?,?)').run(name,email,passwordHash(password),now());res.json({ok:true,user:user(r.lastInsertRowid)});}catch(e){res.status(409).json({error:'Email already registered'})}});
app.post('/api/auth/login',(req,res)=>{const email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');const u=db.prepare('SELECT * FROM users WHERE email=?').get(email);if(!u||!passwordOK(password,u.password_hash))return res.status(401).json({error:'Invalid email or password'});const raw=token(),expires=new Date(Date.now()+Number(process.env.SESSION_DAYS||30)*86400000).toISOString();db.prepare('INSERT INTO sessions(user_id,token_hash,created_at,expires_at) VALUES(?,?,?,?)').run(u.id,hash(raw),now(),expires);res.json({ok:true,token:raw,user:user(u.id)})});
app.post('/api/auth/logout',auth,(req,res)=>{db.prepare('DELETE FROM sessions WHERE id=?').run(req.session.id);res.json({ok:true})});
app.get('/api/me',auth,(req,res)=>{const s=subFor(req.user.id),p=s?PLANS[s.plan]:null;res.json({user:req.user,subscription:s,plan:p,devices:devicesFor(req.user.id)})});
app.get('/api/subscriptions/current',auth,(req,res)=>{const s=subFor(req.user.id);res.json({subscription:s,plan:s?PLANS[s.plan]:null})});
app.get('/api/billing/config',(req,res)=>res.json({
  provider:'manual',
  automaticPayments:false,
  futureProvider:'fnb'
}));

app.post('/api/billing/create-order',auth,(req,res)=>{
  try{
    const planId=String(req.body.plan||'');
    const p=PLANS[planId];

    if(!p)return res.status(400).json({error:'Unknown plan'});

    const providerOrderId=`TC-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    db.prepare(`
      INSERT INTO payment_orders
      (provider,provider_order_id,user_id,plan,amount_minor,currency,status,created_at)
      VALUES(?,?,?,?,?,?,?,?)
    `).run(
      'manual',
      providerOrderId,
      req.user.id,
      planId,
      p.priceMinor,
      p.currency,
      'pending',
      now()
    );

    res.json({
      ok:true,
      orderId:providerOrderId,
      status:'pending',
      plan:p,
      payment:{
        provider:'manual',
        message:'Payment instructions will be provided after order creation.'
      }
    });
  }catch(e){
    res.status(500).json({error:e.message});
  }
});

app.get('/api/billing/order/:orderId',auth,(req,res)=>{
  const order=db.prepare(`
    SELECT *
    FROM payment_orders
    WHERE provider_order_id=? AND user_id=?
  `).get(String(req.params.orderId),req.user.id);

  if(!order)return res.status(404).json({error:'Payment order not found'});

  res.json({ok:true,order});
});


app.get('/api/admin/overview',adminAuth,(req,res)=>{
  const customers=db.prepare("SELECT COUNT(*) c FROM users WHERE role='customer'").get().c;
  const admins=db.prepare("SELECT COUNT(*) c FROM users WHERE role='admin'").get().c;
  const activeSubscriptions=db.prepare("SELECT COUNT(*) c FROM subscriptions WHERE status='active' AND expires_at>?").get(now()).c;
  const pendingPayments=db.prepare("SELECT COUNT(*) c FROM payment_orders WHERE status='pending'").get().c;
  const devices=db.prepare("SELECT COUNT(*) c FROM devices").get().c;

  res.json({
    ok:true,
    admin:req.user,
    statistics:{
      customers,
      admins,
      activeSubscriptions,
      pendingPayments,
      devices
    }
  });
});

app.get('/api/admin/payment-orders',adminAuth,(req,res)=>{
  const status=String(req.query.status||'pending');

  const orders=status==='all'
    ? db.prepare(`
        SELECT po.*,u.name user_name,u.email user_email
        FROM payment_orders po
        JOIN users u ON u.id=po.user_id
        ORDER BY po.id DESC
        LIMIT 200
      `).all()
    : db.prepare(`
        SELECT po.*,u.name user_name,u.email user_email
        FROM payment_orders po
        JOIN users u ON u.id=po.user_id
        WHERE po.status=?
        ORDER BY po.id DESC
        LIMIT 200
      `).all(status);

  res.json({ok:true,orders});
});

app.post('/api/admin/payment-orders/:id/verify',adminAuth,(req,res)=>{
  try{
    const id=Number(req.params.id);

    if(!Number.isInteger(id)||id<1){
      return res.status(400).json({error:'Invalid payment order'});
    }

    const order=db.prepare(`
      SELECT po.*,u.name user_name,u.email user_email
      FROM payment_orders po
      JOIN users u ON u.id=po.user_id
      WHERE po.id=?
    `).get(id);

    if(!order){
      return res.status(404).json({error:'Payment order not found'});
    }

    if(order.status!=='pending'){
      return res.status(400).json({error:`Payment order is already ${order.status}`});
    }

    if(!PLANS[order.plan]){
      return res.status(400).json({error:'Payment order contains an invalid plan'});
    }

    const plan=PLANS[order.plan];

    if(
      Number(order.amount_minor)!==Number(plan.priceMinor) ||
      String(order.currency)!==String(plan.currency)
    ){
      return res.status(400).json({error:'Payment order amount or currency does not match the selected plan'});
    }

    db.prepare(`
      UPDATE payment_orders
      SET status='paid',captured_at=?
      WHERE id=? AND status='pending'
    `).run(now(),id);

    const subscription=activate(
      order.user_id,
      order.plan,
      'manual_admin',
      order.provider_order_id
    );

    adminAudit(
      req.user.id,
      'payment_verified',
      'payment_order',
      id,
      {
        userId:order.user_id,
        email:order.user_email,
        plan:order.plan,
        amountMinor:order.amount_minor,
        currency:order.currency,
        orderId:order.provider_order_id
      }
    );

    res.json({
      ok:true,
      message:'Payment verified and subscription activated.',
      order:{
        id:order.id,
        orderId:order.provider_order_id,
        status:'paid'
      },
      subscription,
      plan
    });
  }catch(e){
    console.error(e);
    res.status(500).json({error:'Could not verify payment order'});
  }
});

app.post('/api/admin/payment-orders/:id/reject',adminAuth,(req,res)=>{
  const id=Number(req.params.id);

  if(!Number.isInteger(id)||id<1){
    return res.status(400).json({error:'Invalid payment order'});
  }

  const order=db.prepare(`
    SELECT *
    FROM payment_orders
    WHERE id=?
  `).get(id);

  if(!order){
    return res.status(404).json({error:'Payment order not found'});
  }

  if(order.status!=='pending'){
    return res.status(400).json({error:`Payment order is already ${order.status}`});
  }

  db.prepare(`
    UPDATE payment_orders
    SET status='rejected'
    WHERE id=? AND status='pending'
  `).run(id);

  adminAudit(
    req.user.id,
    'payment_rejected',
    'payment_order',
    id,
    {
      userId:order.user_id,
      plan:order.plan,
      orderId:order.provider_order_id
    }
  );

  res.json({
    ok:true,
    message:'Payment order rejected.',
    orderId:order.provider_order_id,
    status:'rejected'
  });
});

app.get('/api/admin/audit-log',adminAuth,(req,res)=>{
  const logs=db.prepare(`
    SELECT
      a.id,
      a.action,
      a.target_type,
      a.target_id,
      a.details,
      a.created_at,
      u.email admin_email
    FROM admin_audit_logs a
    JOIN users u ON u.id=a.admin_user_id
    ORDER BY a.id DESC
    LIMIT 200
  `).all();

  res.json({ok:true,logs});
});

app.get('/api/family',auth,requireSub,(req,res)=>{if(req.subscription.plan!=='family')return res.status(400).json({error:'Family plan required'});const root=ownerId(req.user.id);const members=db.prepare('SELECT fm.id,u.id user_id,u.name,u.email,fm.created_at FROM family_members fm JOIN users u ON u.id=fm.member_user_id WHERE fm.owner_user_id=?').all(root);const invites=db.prepare('SELECT id,email,expires_at,accepted_at FROM family_invites WHERE owner_user_id=? ORDER BY id DESC').all(root);res.json({owner:user(root),members,invites})});
app.post('/api/family/invites',auth,requireSub,(req,res)=>{if(req.subscription.plan!=='family'||ownerId(req.user.id)!==req.user.id)return res.status(403).json({error:'Only the Family plan owner can invite members'});const email=String(req.body.email||'').trim().toLowerCase();if(!email.includes('@'))return res.status(400).json({error:'Valid email required'});const count=db.prepare('SELECT COUNT(*) c FROM family_members WHERE owner_user_id=?').get(req.user.id).c;if(count>=4)return res.status(400).json({error:'Family plan already has 5 total device users including the owner'});const raw=token(),expires=new Date(Date.now()+7*86400000).toISOString();db.prepare('INSERT INTO family_invites(owner_user_id,email,token_hash,expires_at) VALUES(?,?,?,?)').run(req.user.id,email,hash(raw),expires);res.json({ok:true,inviteUrl:`${APP_URL}/?invite=${raw}`,expiresAt:expires,message:'Send the invite link to the family member. They must have an account with the same email.'})});
app.post('/api/family/invites/accept',auth,(req,res)=>{const raw=String(req.body.token||'');const inv=db.prepare('SELECT * FROM family_invites WHERE token_hash=? AND expires_at>? AND accepted_at IS NULL').get(hash(raw),now());if(!inv)return res.status(400).json({error:'Invite is invalid or expired'});if(inv.email!==req.user.email)return res.status(403).json({error:'Invite email does not match the signed-in account'});if(inv.owner_user_id===req.user.id)return res.status(400).json({error:'Owner cannot join their own family'});try{db.prepare('INSERT INTO family_members(owner_user_id,member_user_id,created_at) VALUES(?,?,?)').run(inv.owner_user_id,req.user.id,now());db.prepare('UPDATE family_invites SET accepted_at=? WHERE id=?').run(now(),inv.id);res.json({ok:true})}catch(e){res.status(409).json({error:'Already a family member'})}});

app.post('/api/devices/register',auth,requireSub,(req,res)=>{const ids=accessibleIds(req.user.id),qs=ids.map(()=>'?').join(',');const count=db.prepare(`SELECT COUNT(*) c FROM devices WHERE user_id IN (${qs})`).get(...ids).c;if(count>=req.plan.maxDevices)return res.status(400).json({error:`Your ${req.plan.name} plan allows ${req.plan.maxDevices} device(s)`});const b=req.body||{},deviceToken=token(),recoveryId='TC-'+crypto.randomBytes(5).toString('hex').toUpperCase();db.prepare(`INSERT INTO devices(recovery_id,user_id,device_name,platform,manufacturer,model,serial_number,imei,management_mode,enrollment_state,status,registered_at,last_seen_at,device_token_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(recoveryId,req.user.id,String(b.deviceName||'My device'),String(b.platform||'Android'),String(b.manufacturer||''),String(b.model||''),String(b.serialNumber||''),String(b.imei||''),String(b.managementMode||'personal'),String(b.enrollmentState||'enrolled'),'protected',now(),now(),hash(deviceToken));res.json({ok:true,recoveryId,deviceToken,message:'Save this device credential securely. It is shown only once.'})});
app.get('/api/devices',auth,requireSub,(req,res)=>res.json({devices:devicesFor(req.user.id)}));
app.get('/api/devices/:recoveryId',auth,requireSub,(req,res)=>{const d=getDevice(req.user.id,req.params.recoveryId);if(!d)return res.status(404).json({error:'Device not found'});const loc=db.prepare('SELECT latitude,longitude,accuracy,timestamp,source FROM locations WHERE device_id=? ORDER BY id DESC LIMIT 1').get(d.id);const events=db.prepare('SELECT event_type,details,created_at FROM security_events WHERE device_id=? ORDER BY id DESC LIMIT 50').all(d.id);res.json({device:d,lastLocation:loc,events})});
app.post('/api/devices/:recoveryId/status',auth,requireSub,(req,res)=>{const d=getDevice(req.user.id,req.params.recoveryId);if(!d)return res.status(404).json({error:'Device not found'});const allowed=['protected','suspicious','lost','stolen','recovery','recovered'];const status=String(req.body.status||'');if(!allowed.includes(status))return res.status(400).json({error:'Invalid status'});db.prepare('UPDATE devices SET status=? WHERE id=?').run(status,d.id);db.prepare('INSERT INTO security_events(device_id,event_type,details,created_at) VALUES(?,?,?,?)').run(d.id,'status_change',JSON.stringify({from:d.status,to:status,by:req.user.id}),now());res.json({ok:true,status})});
app.post('/api/devices/:recoveryId/rotate-token',auth,requireSub,(req,res)=>{const d=getDevice(req.user.id,req.params.recoveryId);if(!d)return res.status(404).json({error:'Device not found'});const raw=token();db.prepare('UPDATE devices SET device_token_hash=? WHERE id=?').run(hash(raw),d.id);res.json({ok:true,deviceToken:raw,message:'Old device token is now invalid.'})});
app.post('/api/devices/:recoveryId/enrollment',auth,requireSub,(req,res)=>{const d=getDevice(req.user.id,req.params.recoveryId);if(!d)return res.status(404).json({error:'Device not found'});const state=String(req.body.enrollmentState||'');if(!['enrolled','managed','re_enrollment_required'].includes(state))return res.status(400).json({error:'Invalid enrollment state'});db.prepare('UPDATE devices SET enrollment_state=? WHERE id=?').run(state,d.id);res.json({ok:true,enrollmentState:state})});

app.post('/api/device/heartbeat',deviceAuth,(req,res)=>{const d=req.device;const shouldLock=d.status==='stolen';const shouldAlarm=['lost','stolen'].includes(d.status);res.json({ok:true,serverTime:now(),recoveryId:d.recovery_id,status:d.status,enrollmentState:d.enrollment_state,shouldLock,shouldAlarm,locationIntervalMs:60000,pollIntervalMs:300000})});
app.post('/api/device/location',deviceAuth,(req,res)=>{const lat=Number(req.body.latitude),lon=Number(req.body.longitude),acc=Number(req.body.accuracy||0);if(!Number.isFinite(lat)||lat<-90||lat>90||!Number.isFinite(lon)||lon<-180||lon>180)return res.status(400).json({error:'Invalid coordinates'});const t=req.body.timestamp&&Number.isFinite(Date.parse(req.body.timestamp))?new Date(req.body.timestamp).toISOString():now();db.prepare('INSERT INTO locations(device_id,latitude,longitude,accuracy,timestamp,source) VALUES(?,?,?,?,?,?)').run(req.device.id,lat,lon,Number.isFinite(acc)?acc:null,t,String(req.body.source||'gps'));db.prepare('UPDATE devices SET last_seen_at=? WHERE id=?').run(now(),req.device.id);res.json({ok:true,status:req.device.status})});
app.post('/api/device/event',deviceAuth,(req,res)=>{db.prepare('INSERT INTO security_events(device_id,event_type,details,created_at) VALUES(?,?,?,?)').run(req.device.id,String(req.body.eventType||'device_event'),JSON.stringify(req.body.details||{}),now());res.json({ok:true})});

app.use('/api',(req,res)=>res.status(404).json({error:'API route not found'}));
app.use(express.static(path.join(__dirname,'..','public')));
app.use((req,res)=>res.sendFile(path.join(__dirname,'..','public','index.html')));
app.use((err,req,res,next)=>{console.error(err);if(req.path.startsWith('/api'))res.status(500).json({error:'Server error'});else res.status(500).send('Server error')});
setInterval(()=>db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now()),3600000).unref();
app.listen(PORT,()=>console.log(`TraceCore 10.1 running at ${APP_URL}`));
