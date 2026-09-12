const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const dataDir = path.resolve(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'tracecore.db'));
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_MODE = String(process.env.PAYPAL_MODE || 'sandbox').toLowerCase() === 'live' ? 'live' : 'sandbox';
const PAYPAL_BASE = PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || '';
const PAYPAL_PRODUCT_ID = process.env.PAYPAL_PRODUCT_ID || '';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const PAYPAL_PLAN_IDS = {};
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');

async function paypalAccessToken(){
  if(!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) throw new Error('PayPal is not configured.');
  const auth=Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const r=await fetch(`${PAYPAL_BASE}/v1/oauth2/token`,{method:'POST',headers:{Authorization:`Basic ${auth}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
  const d=await r.json();
  if(!r.ok) throw new Error(d.error_description||d.message||'PayPal authentication failed');
  return d.access_token;
}
async function paypalRequest(method,endpoint,body){
  const token=await paypalAccessToken();
  const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json','Accept':'application/json'};
  const r=await fetch(`${PAYPAL_BASE}${endpoint}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const text=await r.text(); let d={}; try{d=text?JSON.parse(text):{}}catch{d={raw:text}}
  if(!r.ok) throw new Error(d.message||d.details?.map(x=>x.description).join('; ')||`PayPal API error ${r.status}`);
  return d;
}
async function ensurePaypalProduct(){
  if(PAYPAL_PRODUCT_ID) return PAYPAL_PRODUCT_ID;
  if(global.__tracecorePaypalProduct) return global.__tracecorePaypalProduct;
  const d=await paypalRequest('POST','/v1/catalogs/products',{name:'TraceCore Device Protection',description:'TraceCore device protection and recovery subscription',type:'SERVICE',category:'SOFTWARE'});
  global.__tracecorePaypalProduct=d.id;
  return d.id;
}
async function ensurePaypalPlan(planId){
  if(PAYPAL_PLAN_IDS[planId]) return PAYPAL_PLAN_IDS[planId];
  const plan=PLANS[planId];
  const productId=await ensurePaypalProduct();
  const d=await paypalRequest('POST','/v1/billing/plans',{product_id:productId,name:`TraceCore ${plan.name}`,description:`TraceCore ${plan.name} monthly subscription`,status:'ACTIVE',billing_cycles:[{frequency:{interval_unit:'MONTH',interval_count:1},tenure_type:'REGULAR',sequence:1,total_cycles:0,pricing_scheme:{fixed_price:{value:(plan.priceMinor/100).toFixed(2),currency_code:plan.currency}}}],payment_preferences:{auto_bill_outstanding:true,payment_failure_threshold:1}});
  PAYPAL_PLAN_IDS[planId]=d.id;
  return d.id;
}
async function activatePaypalSubscription(userId,planId,paypalSub){
  const plan=PLANS[planId];
  if(!plan) return null;
  const details=paypalSub && paypalSub.id ? paypalSub : await paypalRequest('GET',`/v1/billing/subscriptions/${encodeURIComponent(paypalSub)}`);
  if(!['ACTIVE','APPROVAL_PENDING'].includes(details.status)) return details;
  const start=new Date(details.start_time||Date.now());
  const expiry=details.billing_info?.next_billing_time ? new Date(details.billing_info.next_billing_time) : addMonths(start,1);
  db.prepare(`UPDATE subscriptions SET status='cancelled', payment_status='replaced' WHERE user_id=? AND status='active'`).run(userId);
  db.prepare(`INSERT INTO subscriptions(user_id,plan,price_minor,currency,status,started_at,expires_at,provider,provider_customer_id,provider_subscription_id,checkout_session_id,payment_status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(userId,planId,plan.priceMinor,plan.currency,'active',iso(start),iso(expiry),'paypal',details.subscriber?.payer_id||null,details.id,null,'paid');
  logAudit(userId,null,`paypal_subscription_started:${planId}`);
  return details;
}

app.post('/api/billing/webhook', async (req,res)=>{
  if(!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET || !PAYPAL_WEBHOOK_ID) return res.status(503).json({error:'PayPal webhook is not configured'});
  try {
    const token=await paypalAccessToken();
    const verifyBody={auth_algo:req.get('paypal-auth-algo'),cert_url:req.get('paypal-cert-url'),transmission_id:req.get('paypal-transmission-id'),transmission_sig:req.get('paypal-transmission-sig'),transmission_time:req.get('paypal-transmission-time'),webhook_id:PAYPAL_WEBHOOK_ID,event_body:req.body};
    const vr=await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(verifyBody)});
    const vd=await vr.json();
    if(!vr.ok || vd.verification_status!=='SUCCESS') return res.status(400).json({error:'PayPal webhook signature verification failed'});
    const event=req.body;
    const resource=event.resource||{};
    if(event.event_type==='BILLING.SUBSCRIPTION.ACTIVATED'){
      const customId=resource.custom_id||resource.custom||'';
      const [userId,planId]=String(customId).split(':');
      if(Number(userId)&&PLANS[planId]) await activatePaypalSubscription(Number(userId),planId,resource);
    } else if(event.event_type==='PAYMENT.SALE.COMPLETED'){
      const subId=resource.billing_agreement_id;
      if(subId){const local=db.prepare(`SELECT * FROM subscriptions WHERE provider_subscription_id=? ORDER BY id DESC LIMIT 1`).get(subId);if(local){db.prepare(`UPDATE subscriptions SET status='active',payment_status='paid',expires_at=? WHERE id=?`).run(addMonths(now(),1).toISOString(),local.id);}}
    } else if(event.event_type==='BILLING.SUBSCRIPTION.CANCELLED' || event.event_type==='BILLING.SUBSCRIPTION.SUSPENDED'){
      db.prepare(`UPDATE subscriptions SET status='cancelled',payment_status=? WHERE provider_subscription_id=?`).run(event.event_type.endsWith('SUSPENDED')?'suspended':'cancelled',resource.id||'');
    }
    res.json({received:true});
  } catch(e){console.error('PayPal webhook error',e);res.status(500).json({error:'Webhook processing failed'});}
});
app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.resolve(__dirname, '..', 'public')));

const PLANS = {
  personal: { name: 'Personal', priceMinor: 10000, currency: 'ZAR', maxDevices: 1 },
  family: { name: 'Family', priceMinor: 30000, currency: 'ZAR', maxDevices: 5 },
  business_starter: { name: 'Business Starter', priceMinor: 75000, currency: 'ZAR', maxDevices: 10 },
  business: { name: 'Business', priceMinor: 150000, currency: 'ZAR', maxDevices: 25 },
  business_plus: { name: 'Business Plus', priceMinor: 250000, currency: 'ZAR', maxDevices: 50 },
  enterprise: { name: 'Enterprise', priceMinor: 0, currency: 'ZAR', maxDevices: 999999 }
};

function now(){return new Date()}
function iso(d=now()){return d.toISOString()}
function hash(v){return crypto.createHash('sha256').update(v).digest('hex')}
function randomToken(bytes=32){return crypto.randomBytes(bytes).toString('hex')}
function requireDeviceAuth(req,res,next){const h=req.get('authorization')||'';const token=h.startsWith('Device ')?h.slice(7).trim():'';if(!token)return res.status(401).json({error:'Device authentication required'});const d=db.prepare(`SELECT d.* FROM devices d WHERE d.device_token_hash=?`).get(hash(token));if(!d)return res.status(401).json({error:'Invalid device credential'});req.device=d;next()}
function deviceOrOwnerAuth(req,res,next){const h=req.get('authorization')||'';if(h.startsWith('Device '))return requireDeviceAuth(req,res,next);return requireAuth(req,res,next)}
function generateRecoveryId(){return `TC-${crypto.randomBytes(6).toString('hex').toUpperCase()}`}
function addMonths(date,months){const d=new Date(date);d.setMonth(d.getMonth()+months);return d}
function validEmail(e){return typeof e==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)}
function normalizeEmail(e){return String(e||'').trim().toLowerCase()}
function hashPassword(password){const salt=crypto.randomBytes(16).toString('hex');const derived=crypto.scryptSync(password,salt,64).toString('hex');return `${salt}:${derived}`}
function verifyPassword(password,stored){const [salt,expected]=String(stored).split(':');if(!salt||!expected)return false;const actual=crypto.scryptSync(password,salt,64).toString('hex');return crypto.timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(expected,'hex'))}
function publicUser(u){return{id:u.id,email:u.email,accountType:u.account_type,createdAt:u.created_at}}
function activeSubscription(userId){const sub=db.prepare(`SELECT * FROM subscriptions WHERE user_id=? ORDER BY id DESC LIMIT 1`).get(userId);if(!sub)return null;if(sub.status==='active'&&new Date(sub.expires_at)<=now()){db.prepare(`UPDATE subscriptions SET status='expired' WHERE id=?`).run(sub.id);sub.status='expired'}return sub}
function requireAuth(req,res,next){const h=req.get('authorization')||'';const token=h.startsWith('Bearer ')?h.slice(7).trim():'';if(!token)return res.status(401).json({error:'Authentication required'});const s=db.prepare(`SELECT s.*,u.email,u.account_type FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?`).get(hash(token));if(!s||new Date(s.expires_at)<=now())return res.status(401).json({error:'Session expired or invalid'});req.user={id:s.user_id,email:s.email,accountType:s.account_type};next()}
function requireActiveSubscription(req,res,next){const sub=activeSubscription(req.user.id);if(!sub||sub.status!=='active')return res.status(402).json({error:'An active TraceCore subscription is required',code:'SUBSCRIPTION_REQUIRED'});req.subscription=sub;next()}
function deviceLimitFor(sub){return PLANS[sub.plan]?.maxDevices??0}
function deviceCount(userId){return db.prepare(`SELECT COUNT(*) AS count FROM devices WHERE user_id=?`).get(userId).count}
function getOwnedDevice(userId,recoveryId){return db.prepare(`SELECT * FROM devices WHERE user_id=? AND recovery_id=?`).get(userId,recoveryId)}
function logAudit(userId,recoveryId,action){db.prepare(`INSERT INTO audit_logs(user_id,recovery_id,action,recorded_at) VALUES(?,?,?,?)`).run(userId??null,recoveryId??null,action,iso())}
function serializeDevice(d){return{recoveryId:d.recovery_id,deviceName:d.device_name,platform:d.platform,manufacturer:d.manufacturer,model:d.model,serialNumber:d.serial_number,imei:d.imei,status:d.status,registeredAt:d.registered_at,lastSeenAt:d.last_seen_at}}
function issueDeviceToken(){return randomToken(32)}
function parseDetails(details){try{return details?JSON.parse(details):null}catch{return details}}

app.get('/',(req,res)=>res.sendFile(path.resolve(__dirname,'..','public','index.html')));
app.get('/api/health',(req,res)=>res.json({status:'ok',timestamp:iso(),service:'tracecore'}));
app.get('/api/plans',(req,res)=>res.json({currency:'ZAR',plans:Object.entries(PLANS).map(([id,p])=>({id,...p,price:p.priceMinor/100}))}));

app.post('/api/leads',(req,res)=>{const name=String(req.body.name||'').trim(),email=normalizeEmail(req.body.email),phone=String(req.body.phone||'').trim(),accountType=req.body.accountType||'personal',message=String(req.body.message||'').trim();if(name.length<2||!validEmail(email))return res.status(400).json({error:'Name and a valid email are required'});if(!['personal','business'].includes(accountType))return res.status(400).json({error:'Invalid account type'});db.prepare(`INSERT INTO leads(name,email,phone,account_type,message,created_at) VALUES(?,?,?,?,?,?)`).run(name,email,phone||null,accountType,message||null,iso());res.status(201).json({message:'Thank you. TraceCore will contact you shortly.'})});

app.post('/api/auth/register',(req,res)=>{const email=normalizeEmail(req.body.email),password=req.body.password,accountType=req.body.accountType||'personal';if(!validEmail(email)||typeof password!=='string'||password.length<8)return res.status(400).json({error:'Valid email and password of at least 8 characters are required'});if(!['personal','business'].includes(accountType))return res.status(400).json({error:'accountType must be personal or business'});if(db.prepare(`SELECT id FROM users WHERE email=?`).get(email))return res.status(409).json({error:'An account with that email already exists'});const createdAt=iso(),r=db.prepare(`INSERT INTO users(email,password_hash,account_type,created_at) VALUES(?,?,?,?)`).run(email,hashPassword(password),accountType,createdAt),user=db.prepare(`SELECT * FROM users WHERE id=?`).get(r.lastInsertRowid);res.status(201).json({message:'TraceCore account created',user:publicUser(user),next:'Subscribe before registering a protected device.'})});
app.post('/api/auth/login',(req,res)=>{const email=normalizeEmail(req.body.email),password=req.body.password,user=db.prepare(`SELECT * FROM users WHERE email=?`).get(email);if(!user||!verifyPassword(password||'',user.password_hash))return res.status(401).json({error:'Invalid email or password'});const token=randomToken(),createdAt=now(),expires=addMonths(createdAt,1);db.prepare(`INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)`).run(hash(token),user.id,iso(createdAt),iso(expires));res.json({message:'Login successful',token,expiresAt:iso(expires),user:publicUser(user),subscription:activeSubscription(user.id)})});
app.post('/api/auth/logout',requireAuth,(req,res)=>{const h=req.get('authorization')||'',token=h.startsWith('Bearer ')?h.slice(7).trim():'';db.prepare(`DELETE FROM sessions WHERE token_hash=?`).run(hash(token));res.json({message:'Logged out'})});
app.get('/api/me',requireAuth,(req,res)=>{const user=db.prepare(`SELECT * FROM users WHERE id=?`).get(req.user.id);const sub=activeSubscription(req.user.id);res.json({user:publicUser(user),subscription:sub,deviceCount:deviceCount(req.user.id),deviceLimit:sub?deviceLimitFor(sub):0,paymentsConfigured:Boolean(PAYPAL_CLIENT_ID&&PAYPAL_CLIENT_SECRET),paymentProvider:'paypal'})});

app.post('/api/subscriptions/subscribe',requireAuth,async(req,res)=>{
  const planId=req.body.plan||(req.user.accountType==='business'?'business_starter':'personal'),plan=PLANS[planId];
  if(!plan||planId==='enterprise')return res.status(400).json({error:'Choose a supported self-service plan'});
  if(req.user.accountType==='personal'&&!['personal','family'].includes(planId))return res.status(400).json({error:'Personal accounts can use Personal or Family plans'});
  if(req.user.accountType==='business'&&['personal','family'].includes(planId))return res.status(400).json({error:'Business accounts require a business plan'});
  if(!PAYPAL_CLIENT_ID||!PAYPAL_CLIENT_SECRET)return res.status(503).json({error:'PayPal payments are not configured yet. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET on the server first.',code:'PAYMENTS_NOT_CONFIGURED'});
  try{
    const paypalPlanId=await ensurePaypalPlan(planId);
    const sub=await paypalRequest('POST','/v1/billing/subscriptions',{plan_id:paypalPlanId,custom_id:`${req.user.id}:${planId}`,subscriber:{email_address:req.user.email},application_context:{brand_name:'TraceCore',locale:'en-ZA',user_action:'SUBSCRIBE_NOW',shipping_preference:'NO_SHIPPING',return_url:`${APP_URL}/?payment=success`,cancel_url:`${APP_URL}/?payment=cancelled`}});
    const approval=sub.links?.find(x=>x.rel==='approve')?.href;
    if(!approval)return res.status(502).json({error:'PayPal did not return an approval URL'});
    res.json({checkoutUrl:approval,subscriptionId:sub.id,provider:'paypal'});
  }catch(e){console.error('PayPal checkout error',e);res.status(502).json({error:'Could not start PayPal checkout',details:e.message});}
});
app.get('/api/billing/status',requireAuth,async(req,res)=>{const sub=activeSubscription(req.user.id);if(!sub||sub.provider!=='paypal')return res.json({subscription:sub});try{const d=await paypalRequest('GET',`/v1/billing/subscriptions/${encodeURIComponent(sub.provider_subscription_id)}`);res.json({subscription:sub,paypal:{id:d.id,status:d.status,nextBillingTime:d.billing_info?.next_billing_time||null}})}catch(e){res.status(502).json({error:'Could not retrieve PayPal subscription',details:e.message})}});
app.get('/api/subscriptions/current',requireAuth,(req,res)=>res.json({subscription:activeSubscription(req.user.id)}));

app.post('/api/devices/register',requireAuth,requireActiveSubscription,(req,res)=>{const{deviceName,platform,manufacturer,model,serialNumber,imei}=req.body;if(!deviceName||!platform||!model)return res.status(400).json({error:'deviceName, platform and model are required'});const limit=deviceLimitFor(req.subscription);if(deviceCount(req.user.id)>=limit)return res.status(409).json({error:`Your ${PLANS[req.subscription.plan].name} plan allows up to ${limit} protected device(s)`});let recoveryId;do{recoveryId=generateRecoveryId()}while(db.prepare(`SELECT id FROM devices WHERE recovery_id=?`).get(recoveryId));const registeredAt=iso();const deviceToken=issueDeviceToken();db.prepare(`INSERT INTO devices(recovery_id,user_id,device_name,platform,manufacturer,model,serial_number,imei,status,registered_at,last_seen_at,device_token_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(recoveryId,req.user.id,deviceName,String(platform).toLowerCase(),manufacturer||null,model,serialNumber||null,imei||null,'protected',registeredAt,registeredAt,hash(deviceToken));db.prepare(`INSERT INTO security_events(recovery_id,event_type,details,recorded_at) VALUES(?,?,?,?)`).run(recoveryId,'device_registered',JSON.stringify({source:'owner_dashboard'}),registeredAt);logAudit(req.user.id,recoveryId,'device_registered');const device=getOwnedDevice(req.user.id,recoveryId);res.status(201).json({message:'Device registered successfully',device:serializeDevice(device),recovery:{recoveryId,status:'protected'},deviceCredential:deviceToken})});
app.get('/api/devices',requireAuth,(req,res)=>{const devices=db.prepare(`SELECT * FROM devices WHERE user_id=? ORDER BY id ASC`).all(req.user.id);res.json({count:devices.length,devices:devices.map(serializeDevice)})});

app.get('/api/device/me',requireDeviceAuth,(req,res)=>res.json({device:serializeDevice(req.device)}));
app.post('/api/device/heartbeat',requireDeviceAuth,(req,res)=>{const d=req.device;const seen=iso();db.prepare(`UPDATE devices SET last_seen_at=? WHERE id=?`).run(seen,d.id);db.prepare(`INSERT INTO security_events(recovery_id,event_type,details,recorded_at) VALUES(?,?,?,?)`).run(d.recovery_id,'heartbeat',JSON.stringify({source:'device'}),seen);res.json({message:'Heartbeat recorded',recoveryId:d.recovery_id,lastSeenAt:seen,status:d.status})});
app.post('/api/device/location',requireDeviceAuth,(req,res)=>{const d=req.device;const{latitude,longitude,accuracy}=req.body;if(typeof latitude!=='number'||typeof longitude!=='number'||latitude<-90||latitude>90||longitude<-180||longitude>180)return res.status(400).json({error:'Valid latitude and longitude are required'});const recordedAt=iso();db.prepare(`INSERT INTO locations(recovery_id,latitude,longitude,accuracy,recorded_at) VALUES(?,?,?,?,?)`).run(d.recovery_id,latitude,longitude,typeof accuracy==='number'?accuracy:null,recordedAt);db.prepare(`UPDATE devices SET last_seen_at=? WHERE id=?`).run(recordedAt,d.id);db.prepare(`INSERT INTO security_events(recovery_id,event_type,details,recorded_at) VALUES(?,?,?,?)`).run(d.recovery_id,'location_update',JSON.stringify({latitude,longitude,accuracy:typeof accuracy==='number'?accuracy:null,source:'device'}),recordedAt);res.status(201).json({message:'Location recorded',location:{recoveryId:d.recovery_id,latitude,longitude,accuracy:typeof accuracy==='number'?accuracy:null,recordedAt}})});
app.post('/api/device/security-event',requireDeviceAuth,(req,res)=>{const d=req.device;const allowed=['sim_changed','sim_removed','offline','reconnected','security_change','location_update','factory_reset_signal'];const eventType=String(req.body.eventType||'');if(!allowed.includes(eventType))return res.status(400).json({error:'Unsupported security event'});const recordedAt=iso();const details=typeof req.body.details==='string'?req.body.details:JSON.stringify(req.body.details||{source:'device'});db.prepare(`INSERT INTO security_events(recovery_id,event_type,details,recorded_at) VALUES(?,?,?,?)`).run(d.recovery_id,eventType,details,recordedAt);if(['sim_changed','sim_removed','factory_reset_signal'].includes(eventType)&&d.status==='protected')db.prepare(`UPDATE devices SET status='suspicious' WHERE id=?`).run(d.id);res.status(201).json({message:'Security event recorded',eventType,status:getOwnedDevice(d.user_id,d.recovery_id).status,recordedAt})});

app.post('/api/devices/:recoveryId/device-credential',requireAuth,(req,res)=>{const d=getOwnedDevice(req.user.id,req.params.recoveryId);if(!d)return res.status(404).json({error:'Device not found'});const token=issueDeviceToken();db.prepare(`UPDATE devices SET device_token_hash=? WHERE id=?`).run(hash(token),d.id);logAudit(req.user.id,d.recovery_id,'device_credential_issued');res.json({recoveryId:d.recovery_id,deviceCredential:token,message:'Device credential issued. Store it securely.'})});

app.post('/api/devices/:recoveryId/heartbeat',deviceOrOwnerAuth,(req,res)=>{const d=req.device||getOwnedDevice(req.user.id,req.params.recoveryId);if(!d||d.recovery_id!==req.params.recoveryId)return res.status(404).json({error:'Device not found'});const seen=iso();db.prepare(`UPDATE devices SET last_seen_at=? WHERE id=?`).run(seen,d.id);db.prepare(`INSERT INTO security_events(recovery_id,event_type,details,recorded_at) VALUES(?,?,?,?)`).run(d.recovery_id,'heartbeat',JSON.stringify({source:'device'}),seen);res.json({message:'Heartbeat recorded',recoveryId:d.recovery_id,lastSeenAt:seen,status:d.status})});
app.post('/api/devices/:recoveryId/location',deviceOrOwnerAuth,(req,res)=>{const d=req.device||getOwnedDevice(req.user.id,req.params.recoveryId);if(!d||d.recovery_id!==req.params.recoveryId)return res.status(404).json({error:'Device not found'});const{latitude,longitude,accuracy}=req.body;if(typeof latitude!=='number'||typeof longitude!=='number'||latitude<-90||latitude>90||longitude<-180||longitude>180)return res.status(400).json({error:'Valid latitude and longitude are required'});const recordedAt=iso();db.prepare(`INSERT INTO locations(recovery_id,latitude,longitude,accuracy,recorded_at) VALUES(?,?,?,?,?)`).run(d.recovery_id,latitude,longitude,typeof accuracy==='number'?accuracy:null,recordedAt);db.prepare(`UPDATE devices SET last_seen_at=? WHERE id=?`).run(recordedAt,d.id);db.prepare(`INSERT INTO security_events(recovery_id,event_type,details,recorded_at) VALUES(?,?,?,?)`).run(d.recovery_id,'location_update',JSON.stringify({latitude,longitude,accuracy:typeof accuracy==='number'?accuracy:null,source:'device'}),recordedAt);res.status(201).json({message:'Location recorded',location:{recoveryId:d.recovery_id,latitude,longitude,accuracy:typeof accuracy==='number'?accuracy:null,recordedAt}})});
app.get('/api/devices/:recoveryId/locations',requireAuth,(req,res)=>{const d=getOwnedDevice(req.user.id,req.params.recoveryId);if(!d)return res.status(404).json({error:'Device not found'});const locations=db.prepare(`SELECT recovery_id AS recoveryId,latitude,longitude,accuracy,recorded_at AS recordedAt FROM locations WHERE recovery_id=? ORDER BY id DESC`).all(d.recovery_id);res.json({recoveryId:d.recovery_id,count:locations.length,locations})});

app.post('/api/devices/:recoveryId/security-event',requireAuth,(req,res)=>{const d=getOwnedDevice(req.user.id,req.params.recoveryId);if(!d)return res.status(404).json({error:'Device not found'});const allowed=['sim_changed','sim_removed','offline','reconnected','security_change','location_update','factory_reset_signal'];const eventType=String(req.body.eventType||'');if(!allowed.includes(eventType))return res.status(400).json({error:'Unsupported security event'});const recordedAt=iso();const details=typeof req.body.details==='string'?req.body.details:JSON.stringify(req.body.details||{source:'device'});db.prepare(`INSERT INTO security_events(recovery_id,event_type,details,recorded_at) VALUES(?,?,?,?)`).run(d.recovery_id,eventType,details,recordedAt);if(['sim_changed','sim_removed','factory_reset_signal'].includes(eventType)&&d.status==='protected'){db.prepare(`UPDATE devices SET status='suspicious' WHERE id=?`).run(d.id);logAudit(req.user.id,d.recovery_id,`device_status:suspicious:${eventType}`)}logAudit(req.user.id,d.recovery_id,`security_event:${eventType}`);res.status(201).json({message:'Security event recorded',eventType,status:getOwnedDevice(req.user.id,d.recovery_id).status,recordedAt})});

app.post('/api/devices/:recoveryId/report',requireAuth,(req,res)=>{const d=getOwnedDevice(req.user.id,req.params.recoveryId);if(!d)return res.status(404).json({error:'Device not found'});const status=req.body.status;if(!['suspicious','lost','stolen','recovery','recovered'].includes(status))return res.status(400).json({error:'status must be suspicious, lost, stolen, recovery or recovered'});const recordedAt=iso();db.prepare(`UPDATE devices SET status=? WHERE id=?`).run(status,d.id);db.prepare(`INSERT INTO security_events(recovery_id,event_type,details,recorded_at) VALUES(?,?,?,?)`).run(d.recovery_id,`status_${status}`,JSON.stringify({source:'owner_dashboard'}),recordedAt);logAudit(req.user.id,d.recovery_id,`device_status:${status}`);res.json({message:`Device marked ${status}`,device:serializeDevice(getOwnedDevice(req.user.id,d.recovery_id))})});

app.get('/api/devices/:recoveryId/recovery',requireAuth,(req,res)=>{const d=getOwnedDevice(req.user.id,req.params.recoveryId);if(!d)return res.status(404).json({error:'Device not found'});const events=db.prepare(`SELECT event_type AS eventType,details,recorded_at AS recordedAt FROM security_events WHERE recovery_id=? ORDER BY id DESC LIMIT 100`).all(d.recovery_id).map(e=>({...e,details:parseDetails(e.details)}));const locations=db.prepare(`SELECT latitude,longitude,accuracy,recorded_at AS recordedAt FROM locations WHERE recovery_id=? ORDER BY id DESC LIMIT 20`).all(d.recovery_id);res.json({device:serializeDevice(d),case:{active:['lost','stolen','recovery'].includes(d.status),status:d.status,openedAt:events.find(e=>['status_lost','status_stolen'].includes(e.eventType))?.recordedAt||null},events,locations})});
app.get('/api/devices/:recoveryId/events',requireAuth,(req,res)=>{const d=getOwnedDevice(req.user.id,req.params.recoveryId);if(!d)return res.status(404).json({error:'Device not found'});const events=db.prepare(`SELECT event_type AS eventType,details,recorded_at AS recordedAt FROM security_events WHERE recovery_id=? ORDER BY id DESC`).all(d.recovery_id).map(e=>({...e,details:parseDetails(e.details)}));res.json({recoveryId:d.recovery_id,events})});

app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:'Internal server error'})});
app.listen(PORT,'0.0.0.0',()=>console.log(`TraceCore V9.1 running on port ${PORT}`));
