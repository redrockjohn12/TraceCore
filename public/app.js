const $=id=>document.getElementById(id);

let auth=localStorage.getItem('tracecore_token')||'';

const api=async(path,opt={})=>{
  opt.headers={
    ...(opt.headers||{}),
    'Content-Type':'application/json',
    ...(auth?{Authorization:'Bearer '+auth}:{})
  };

  const r=await fetch('/api'+path,opt);

  const d=await r.json().catch(()=>({
    error:'Invalid server response'
  }));

  if(!r.ok)throw Error(d.error||`HTTP ${r.status}`);

  return d;
};


function msg(id,text,type=''){
  const el=$(id);
  if(!el)return;
  el.textContent=text;
  el.className='formMessage '+type;
}


function showLanding(){
  $('landingView').classList.remove('hidden');
  $('authView').classList.add('hidden');
  $('appView').classList.add('hidden');

  $('publicNav').classList.remove('hidden');
  $('customerNav').classList.add('hidden');

  window.scrollTo(0,0);
}


function showLogin(){
  $('landingView').classList.add('hidden');
  $('authView').classList.remove('hidden');
  $('appView').classList.add('hidden');

  $('publicNav').classList.add('hidden');
  $('customerNav').classList.add('hidden');

  $('loginForm').classList.remove('hidden');
  $('registerForm').classList.add('hidden');

  $('authTitle').textContent='Welcome back';
  $('authSubtitle').textContent='Sign in to your TraceCore account.';
  $('switchText').textContent="Don't have an account?";
  $('switchButton').textContent='Create account';

  window.scrollTo(0,0);
}


function showRegister(){
  $('landingView').classList.add('hidden');
  $('authView').classList.remove('hidden');
  $('appView').classList.add('hidden');

  $('publicNav').classList.add('hidden');
  $('customerNav').classList.add('hidden');

  $('loginForm').classList.add('hidden');
  $('registerForm').classList.remove('hidden');

  $('authTitle').textContent='Create your account';
  $('authSubtitle').textContent='Start protecting your devices with TraceCore.';
  $('switchText').textContent='Already have an account?';
  $('switchButton').textContent='Sign in';

  window.scrollTo(0,0);
}


function toggleAuthMode(){
  if($('loginForm').classList.contains('hidden')){
    showLogin();
  }else{
    showRegister();
  }
}


function showDashboard(){
  $('landingView').classList.add('hidden');
  $('authView').classList.add('hidden');
  $('appView').classList.remove('hidden');

  $('publicNav').classList.add('hidden');
  $('customerNav').classList.remove('hidden');

  window.scrollTo(0,0);
}


async function logoutUser(){
  try{
    await api('/auth/logout',{method:'POST'});
  }catch{}

  auth='';
  localStorage.removeItem('tracecore_token');
  showLanding();
}


$('loginForm').onsubmit=async e=>{
  e.preventDefault();

  msg('loginMsg','Signing in...');

  try{
    const d=await api('/auth/login',{
      method:'POST',
      body:JSON.stringify({
        email:$('loginEmail').value.trim(),
        password:$('loginPassword').value
      })
    });

    auth=d.token;
    localStorage.setItem('tracecore_token',auth);

    $('loginPassword').value='';

    await loadDashboard();

  }catch(x){
    msg('loginMsg',x.message,'error');
  }
};


$('registerForm').onsubmit=async e=>{
  e.preventDefault();

  msg('regMsg','Creating your account...');

  try{
    await api('/auth/register',{
      method:'POST',
      body:JSON.stringify({
        name:$('regName').value.trim(),
        email:$('regEmail').value.trim(),
        password:$('regPassword').value
      })
    });

    msg(
      'regMsg',
      'Account created successfully. You can now sign in.',
      'success'
    );

    setTimeout(()=>showLogin(),900);

  }catch(x){
    msg('regMsg',x.message,'error');
  }
};


$('deviceForm').onsubmit=async e=>{
  e.preventDefault();

  msg('deviceMsg','Registering device...');

  try{
    const d=await api('/devices/register',{
      method:'POST',
      body:JSON.stringify({
        deviceName:$('deviceName').value.trim(),
        platform:$('platform').value,
        manufacturer:$('manufacturer').value.trim(),
        model:$('model').value.trim(),
        serialNumber:$('serial').value.trim(),
        imei:$('imei').value.trim(),
        managementMode:$('management').value
      })
    });

    $('tokenOut').value=d.deviceToken||'';

    if($('tokenDialog').showModal){
      $('tokenDialog').showModal();
    }

    msg(
      'deviceMsg',
      `Device registered. Recovery ID: ${d.recoveryId}`,
      'success'
    );

    e.target.reset();

    await loadDashboard();

  }catch(x){
    msg('deviceMsg',x.message,'error');
  }
};


$('copyToken').onclick=async()=>{
  try{
    await navigator.clipboard.writeText($('tokenOut').value);
    $('copyToken').textContent='Copied!';
    setTimeout(()=>{
      $('copyToken').textContent='Copy credential';
    },1500);
  }catch{
    $('tokenOut').select();
    document.execCommand('copy');
  }
};


$('closeDialog').onclick=()=>{
  $('tokenDialog').close();
};


$('inviteForm').onsubmit=async e=>{
  e.preventDefault();

  msg('inviteMsg','Creating invitation...');

  try{
    const d=await api('/family/invites',{
      method:'POST',
      body:JSON.stringify({
        email:$('inviteEmail').value.trim()
      })
    });

    msg(
      'inviteMsg',
      `Invitation created: ${d.inviteUrl||'Invite generated.'}`,
      'success'
    );

    $('inviteEmail').value='';

    await loadFamily();

  }catch(x){
    msg('inviteMsg',x.message,'error');
  }
};


async function buy(plan){
  try{
    const d=await api('/billing/create-order',{
      method:'POST',
      body:JSON.stringify({plan})
    });

    if(!d.ok){
      throw new Error(d.error||'Could not create payment order');
    }

    const p=d.plan;
    const box=$('paymentBox');
    const details=$('paymentDetails');

    if(box && details){
      box.classList.remove('hidden');

      details.innerHTML=`
        <div class="paymentPlan">
          <strong>${esc(p.name)}</strong>
          <span>R${(p.priceMinor/100).toFixed(2)} / month</span>
        </div>

        <div class="paymentReference">
          <span>Payment reference</span>
          <strong>${esc(d.orderId)}</strong>
        </div>

        <p class="paymentNotice">
          Your payment order has been created. Keep this reference when making payment.
          Your subscription will be activated after the payment is verified.
        </p>

        <div class="paymentStatus">
          <span>Status</span>
          <strong>Payment pending</strong>
        </div>
      `;

      box.scrollIntoView({
        behavior:'smooth',
        block:'center'
      });
    }

    await refresh();

  }catch(e){
    alert(e.message||'Payment order could not be created');
  }
}


async function setStatus(id,status){

  if(status==='lost'||status==='stolen'){

    const deviceName=
      document.querySelector(`[data-recovery="${CSS.escape(id)}"] .deviceName`)
      ?.textContent||'this device';

    const ok=confirm(
      `Change ${deviceName} to ${status.toUpperCase()} status?`
    );

    if(!ok)return;
  }

  try{

    await api(
      '/devices/'+encodeURIComponent(id)+'/status',
      {
        method:'POST',
        body:JSON.stringify({status})
      }
    );

    await loadDashboard();

  }catch(x){
    alert(x.message);
  }
}


function money(p){

  const value=
    Number(p.price??(Number(p.priceMinor||0)/100));

  return 'R'+value.toLocaleString('en-ZA',{
    minimumFractionDigits:0,
    maximumFractionDigits:0
  })+'/month';
}


async function loadDashboard(){

  if(!auth){
    showLanding();
    return;
  }

  try{

    const d=await api('/me');

    showDashboard();

    const user=d.user||{};

    $('welcome').textContent=
      `Welcome, ${user.name||'Customer'}`;

    $('navUser').textContent=
      user.email||'';

    const plan=d.plan||null;

    $('planBadge').textContent=
      plan
      ? `${plan.name} • ${money(plan)}`
      : 'No active plan';

    $('activePlanName').textContent=
      plan?.name||'—';

    $('deviceLimit').textContent=
      plan?.maxDevices??'—';

    const devices=d.devices||[];

    $('deviceCount').textContent=devices.length;

    renderPlans(plan?.id);

    renderDevices(devices);

    renderCurrentPlan(plan);

    if(plan?.id==='family'){
      await loadFamily();
    }else{
      $('familyList').innerHTML='';
    }

  }catch(x){

    auth='';
    localStorage.removeItem('tracecore_token');

    showLogin();

    msg('loginMsg',x.message,'error');
  }
}


async function loadPublicPlans(){

  try{

    const d=await api('/plans');

    const plans=d.plans||[];

    $('publicPlans').innerHTML=plans.map((p,i)=>`

      <article class="publicPlan ${i===1?'featured':''}">

        <span class="eyebrow">${esc(p.name)}</span>

        <div class="planPrice">
          ${money(p)}
        </div>

        <div class="planDevices">
          Up to ${p.maxDevices} device${p.maxDevices>1?'s':''}
        </div>

        <button
          class="primaryButton full"
          onclick="showRegister()">
          Get started
        </button>

      </article>

    `).join('');

  }catch{

    $('publicPlans').innerHTML=`
      <div class="loadingCard">
        Plans are currently unavailable.
      </div>
    `;
  }
}


async function renderPlans(active){

  try{

    const d=await api('/plans');

    const plans=d.plans||[];

    $('plans').innerHTML=plans.map(p=>`

      <div class="miniPlan">

        <div>
          <strong>${esc(p.name)}</strong>
          <div>${money(p)}</div>
        </div>

        ${
          p.id===active
          ? '<span>Current</span>'
          : `<button onclick="buy('${esc(p.id)}')">Choose</button>`
        }

      </div>

    `).join('');

  }catch{

    $('plans').innerHTML='';
  }
}


function renderCurrentPlan(plan){

  if(!plan){

    $('currentPlan').innerHTML=`
      <strong>No active plan</strong>
      <span>Choose a plan below to protect your devices.</span>
    `;

    return;
  }

  $('currentPlan').innerHTML=`
    <strong>${esc(plan.name)}</strong>
    <span>
      ${money(plan)} · Up to ${plan.maxDevices} device${plan.maxDevices>1?'s':''}
    </span>
  `;
}


function renderDevices(ds){

  if(!ds.length){

    $('devices').innerHTML=`
      <div class="emptyState">
        <strong>No protected devices yet.</strong>
        <br>
        Register your first device to begin.
      </div>
    `;

    return;
  }

  $('devices').innerHTML=ds.map(d=>`

    <article class="device" data-recovery="${esc(d.recovery_id)}">

      <div class="deviceTop">

        <div>

          <div class="deviceName">
            ${esc(d.device_name)}
          </div>

          <div class="deviceMeta">
            ${esc(d.platform||'')}
            ${d.manufacturer?' · '+esc(d.manufacturer):''}
            ${d.model?' · '+esc(d.model):''}
          </div>

          <div class="deviceMeta">
            Registered ${formatDate(d.registered_at)}
          </div>

        </div>

        <span class="status ${esc(d.status)}">
          ${esc(d.status)}
        </span>

      </div>

      <div class="recoveryId">
        Recovery ID: <strong>${esc(d.recovery_id)}</strong>
      </div>

      <div class="deviceButtons">

        ${[
          'protected',
          'suspicious',
          'lost',
          'stolen',
          'recovery',
          'recovered'
        ].map(s=>`

          <button onclick="setStatus('${esc(d.recovery_id)}','${s}')">
            ${s}
          </button>

        `).join('')}

      </div>

      <div id="loc-${safeId(d.recovery_id)}" class="locationBox">
        Loading latest location...
      </div>

    </article>

  `).join('');


  ds.forEach(async d=>{

    try{

      const x=await api(
        '/devices/'+encodeURIComponent(d.recovery_id)
      );

      const l=x.lastLocation;

      const target=$('loc-'+safeId(d.recovery_id));

      if(!target)return;

      if(!l){

        target.textContent=
          'No location has been reported by this device yet.';

        return;
      }

      target.innerHTML=`

        <strong>Last reported location</strong><br>

        ${Number(l.latitude).toFixed(6)},
        ${Number(l.longitude).toFixed(6)}

        · ${formatDate(l.timestamp)}

        ${l.accuracy
          ? ` · accuracy ${Number(l.accuracy).toFixed(0)}m`
          : ''
        }

        <br>

        <a
          target="_blank"
          rel="noopener"
          href="https://www.openstreetmap.org/?mlat=${encodeURIComponent(l.latitude)}&mlon=${encodeURIComponent(l.longitude)}#map=18/${encodeURIComponent(l.latitude)}/${encodeURIComponent(l.longitude)}">
          Open location map →
        </a>

      `;

    }catch{

      const target=$('loc-'+safeId(d.recovery_id));

      if(target){
        target.textContent='Location information unavailable.';
      }

    }

  });
}


async function loadFamily(){

  try{

    const d=await api('/family');

    const members=d.members||[];

    $('familyList').innerHTML=

      `<div style="margin-top:15px;font-weight:800">
        Family members
      </div>`

      +

      (

        members.length

        ? members.map(x=>`

            <div class="familyMember">
              <strong>${esc(x.name)}</strong><br>
              <span>${esc(x.email)}</span>
            </div>

          `).join('')

        : `<div class="familyMember">
             No family members yet.
           </div>`

      );

  }catch{

    $('familyList').innerHTML='';
  }
}


function scrollToRegisterDevice(){

  $('registerDeviceSection').scrollIntoView({
    behavior:'smooth',
    block:'center'
  });
}


function formatDate(value){

  if(!value)return'Unknown';

  const d=new Date(value);

  if(Number.isNaN(d.getTime()))return String(value);

  return d.toLocaleString();
}


function safeId(value){

  return btoa(String(value))
    .replace(/[^a-zA-Z0-9]/g,'_');
}


function esc(v){

  return String(v??'').replace(
    /[&<>"']/g,
    c=>({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[c])
  );
}


(async()=>{

  loadPublicPlans();

  const q=new URLSearchParams(location.search);

  

    history.replaceState(
      {},
      '',
      location.pathname
    );



  if(q.get('invite')&&auth){

    try{

      await api('/family/invites/accept',{
        method:'POST',
        body:JSON.stringify({
          token:q.get('invite')
        })
      });

      alert('Family invitation accepted.');

      history.replaceState(
        {},
        '',
        location.pathname
      );

    }catch(x){

      alert(x.message);
    }
  }


  if(auth){

    await loadDashboard();

  }else{

    showLanding();
  }

})();
