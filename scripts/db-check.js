require('dotenv').config();
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(require('path').join(__dirname,'..','data','tracecore.db'));
for(const t of ['users','sessions','subscriptions','devices','locations','security_events','family_members','family_invites','payment_orders']){try{console.log(t,db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c)}catch(e){console.log(t,'missing')}}
