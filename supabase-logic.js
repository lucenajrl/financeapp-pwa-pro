// FinanceApp Pro — Supabase Sync
// Estratégia: save periódico a cada 10s + save no beforeunload

let _currentUser = null;
let _isSyncing = false;
const ADMIN_EMAIL = 'jardsonlucena97@gmail.com';
const TRIAL_DURATION_MS = 5 * 60 * 1000;
let _trialStartTime = null;
let _trialInterval = null;

// ── PEGAR USUÁRIO ──
async function _getUser() {
    try {
        // Primeiro tentar getSession (local, sem rede)
        const { data: sd } = await _supabase.auth.getSession();
        if (sd && sd.session && sd.session.user) return sd.session.user;
        // Fallback: getUser (rede)
        const { data: ud } = await _supabase.auth.getUser();
        return ud && ud.user ? ud.user : null;
    } catch(e) { return null; }
}

// ── SALVAR NO SUPABASE ──
async function saveUserData() {
    if (_isSyncing) return;
    const user = _currentUser || await _getUser();
    if (!user) return;
    _isSyncing = true;
    try {
        // Ler dados DIRETAMENTE do localStorage (sempre frescos)
        function _ls(k, def) {
            try { return JSON.parse(localStorage.getItem(k)) || def; } catch(e) { return def; }
        }
        await _supabase.from('user_data').upsert({
            user_email: user.email,
            data_v:   _ls('fa_v', []),
            data_m:   _ls('fa_m', []),
            data_c:   _ls('fa_c', []),
            data_fat: _ls('fa_fat', []),
            data_e:   _ls('fa_e', []),
            data_p:   _ls('fa_p', []),
            data_cl:  _ls('fa_cl', {}),
            data_cf:  _ls('fa_cf', {}),
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_email' });
    } catch(err) {
        console.error('[FinanceApp] saveUserData erro:', err.message);
    }
    _isSyncing = false;
}

// ── CARREGAR DO SUPABASE ──
async function loadUserData() {
    const user = _currentUser || await _getUser();
    if (!user) return;
    try {
        const { data } = await _supabase
            .from('user_data')
            .select('*')
            .eq('user_email', user.email)
            .maybeSingle();

        if (data) {
            // Salvar no localStorage para o app ler
            function _lss(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} }
            _lss('fa_v',   data.data_v   || []);
            _lss('fa_m',   data.data_m   || []);
            _lss('fa_c',   data.data_c   || []);
            _lss('fa_fat', data.data_fat || []);
            _lss('fa_e',   data.data_e   || []);
            _lss('fa_p',   data.data_p   || []);
            _lss('fa_cl',  data.data_cl  || {});
            _lss('fa_cf',  data.data_cf  || {});
            // Atualizar variáveis globais do app
            try { V   = data.data_v   || []; } catch(e) {}
            try { M   = data.data_m   || []; } catch(e) {}
            try { C   = data.data_c   || []; } catch(e) {}
            try { FAT = data.data_fat || []; } catch(e) {}
            try { E   = data.data_e   || []; } catch(e) {}
            try { P   = data.data_p   || []; } catch(e) {}
            try { CL  = data.data_cl  || {}; } catch(e) {}
            try { if (data.data_cf) Object.assign(CF, data.data_cf); } catch(e) {}
            // Re-render
            try { if (typeof rDash === 'function') setTimeout(rDash, 100); } catch(e) {}
        } else {
            // Novo usuário — criar registro vazio
            await _supabase.from('user_data').insert({
                user_email: user.email,
                data_v: [], data_m: [], data_c: [], data_fat: [],
                data_e: [], data_p: [], data_cl: {}, data_cf: {}
            });
        }
    } catch(err) {
        console.error('[FinanceApp] loadUserData erro:', err.message);
    }
}

// ── INICIALIZAR ──
window.addEventListener('load', async function() {
    // Pegar usuário logado
    _currentUser = await _getUser();
    
    if (_currentUser) {
        // Carregar dados do Supabase
        await loadUserData();
        
        // Verificar admin/trial
        setTimeout(function() { try { checkAdmin(); } catch(e) {} }, 300);
    }

    // SAVE PERIÓDICO a cada 10 segundos — roda sempre
    // saveUserData() verifica o usuário internamente
    setInterval(function() {
        _getUser().then(function(u) {
            if (u) { _currentUser = u; saveUserData(); }
        });
    }, 10000);
    
    // Save ao sair da página
    window.addEventListener('beforeunload', function() {
        _getUser().then(function(u) {
            if (u) { _currentUser = u; saveUserData(); }
        });
    });
});

// ── ADMIN ──
function checkAdmin() {
    const btn = document.getElementById('adminBtn');
    if (!btn) return;
    _supabase.auth.getUser().then(function(r) {
        const email = r.data && r.data.user ? r.data.user.email : null;
        if (!email) return;
        if (email === ADMIN_EMAIL) {
            btn.style.display = 'flex';
            btn.style.visibility = 'visible';
            btn.style.opacity = '1';
        } else {
            btn.style.display = 'none';
            // Verificar assinatura
            _supabase.from('subscriptions').select('*').eq('email', email).maybeSingle().then(function(r2) {
                if (r2.data) {
                    if (r2.data.status === 'blocked') { showPaymentScreen(email); return; }
                    if (r2.data.expires_at && new Date(r2.data.expires_at) < new Date()) { showPaymentScreen(email); return; }
                    if (r2.data.status === 'active') return;
                }
                initTrialTimer(email);
            });
        }
    });
}

// ── TRIAL ──
function initTrialTimer(email) {
    if (_trialInterval) return;
    const userId = _currentUser ? _currentUser.id : email;
    const key = 'trial_' + userId;
    const saved = localStorage.getItem(key);
    _trialStartTime = saved ? parseInt(saved) : Date.now();
    if (!saved) localStorage.setItem(key, String(_trialStartTime));
    _trialInterval = setInterval(function() {
        if (document.getElementById('paymentScreen')) return;
        if (Date.now() - _trialStartTime >= TRIAL_DURATION_MS) {
            clearInterval(_trialInterval);
            showPaymentScreen(email);
        }
    }, 5000);
}

function showPaymentScreen(email) {
    const main = document.querySelector('main');
    if (main) main.style.display = 'none';
    if (document.getElementById('paymentScreen')) return;
    const link = 'https://api.whatsapp.com/send?phone=5588982146483&text=' + encodeURIComponent('Quero assinar FinanceApp Pro. Email: ' + email);
    const div = document.createElement('div');
    div.id = 'paymentScreen';
    div.style.cssText = 'position:fixed;inset:0;background:#05070F;display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;';
    const box = document.createElement('div');
    box.style.cssText = 'background:#0D1526;border:1px solid rgba(79,142,247,.25);border-radius:20px;padding:32px;max-width:420px;width:100%;text-align:center;';
    box.innerHTML = '<h2 style="color:#F1F5F9;margin-bottom:12px;font-size:22px;">Periodo gratuito encerrado</h2><p style="color:#94A3B8;font-size:13px;margin-bottom:20px;">Voce utilizou seus 5 minutos de acesso gratuito.</p><div style="background:rgba(79,142,247,.08);border-radius:10px;padding:12px;margin-bottom:20px;"><div style="font-size:11px;color:#64748B;margin-bottom:4px">Seu e-mail</div><div style="color:#93C5FD;font-weight:600">' + email + '</div></div>';
    const btnWA = document.createElement('button');
    btnWA.textContent = 'Quero assinar - WhatsApp';
    btnWA.style.cssText = 'width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;font-weight:700;cursor:pointer;margin-bottom:10px;font-size:14px;display:block;';
    btnWA.addEventListener('click', function() { window.open(link, '_blank'); });
    const btnSair = document.createElement('button');
    btnSair.textContent = 'Sair';
    btnSair.style.cssText = 'width:100%;padding:11px;border-radius:10px;border:1px solid rgba(239,68,68,.3);background:transparent;color:#EF4444;font-weight:600;cursor:pointer;font-size:13px;';
    btnSair.addEventListener('click', function() { try { authSair(); } catch(e) { location.reload(); } });
    box.appendChild(btnWA);
    box.appendChild(btnSair);
    div.appendChild(box);
    document.body.appendChild(div);
}

// ── PAINEL ADM ──
let _admSubs = [];
async function admLoad() {
    admCards();
    const tb = document.getElementById('admTbody');
    if (tb) tb.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--t3)">Carregando...</td></tr>';
    try {
        const { data, error } = await _supabase.from('subscriptions').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        _admSubs = data || [];
        admRender(); admCards();
    } catch(e) {
        if (tb) tb.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--rd)">Erro ao carregar.</td></tr>';
    }
}
function admFilter() { admRender(); }
function setAdmPlano(val) {
    const el = document.getElementById('admPlano');
    if (el) el.value = val;
    ['mensal','trimestral','semestral','anual'].forEach(function(p) {
        const b = document.getElementById('admp_' + p);
        if (b) b.classList.toggle('on', p === val);
    });
}
function admCards() {
    const el = document.getElementById('admCards');
    if (!el) return;
    const now = new Date();
    const ativos = _admSubs.filter(function(s){ return s.status==='active' && (!s.expires_at || new Date(s.expires_at) > now); }).length;
    const bloqueados = _admSubs.filter(function(s){ return s.status==='blocked'; }).length;
    const vencidos = _admSubs.filter(function(s){ return s.status==='active' && s.expires_at && new Date(s.expires_at) < now; }).length;
    el.innerHTML = [
        '<div class="card"><div class="ch"><div class="cl">Total</div></div><div class="cv">'+_admSubs.length+'</div><div class="cs">cadastrados</div></div>',
        '<div class="card"><div class="ch"><div class="cl">Ativos</div></div><div class="cv cg">'+ativos+'</div><div class="cs up">pagantes</div></div>',
        '<div class="card"><div class="ch"><div class="cl">Vencidos</div></div><div class="cv cy">'+vencidos+'</div><div class="cs wn">pendente</div></div>',
        '<div class="card"><div class="ch"><div class="cl">Bloqueados</div></div><div class="cv cr">'+bloqueados+'</div><div class="cs dn">sem acesso</div></div>'
    ].join('');
}
function admRender() {
    const tb = document.getElementById('admTbody');
    if (!tb) return;
    const q = ((document.getElementById('admSearch')||{}).value||'').toLowerCase();
    const subs = _admSubs.filter(function(s){ return !q || s.email.toLowerCase().includes(q); });
    if (!subs.length) { tb.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--t3)">Nenhum encontrado</td></tr>'; return; }
    const now = new Date();
    tb.innerHTML = subs.map(function(s) {
        const own = s.email === ADMIN_EMAIL;
        const venc = s.expires_at && new Date(s.expires_at) < now;
        const exp = s.expires_at ? new Date(s.expires_at).toLocaleDateString('pt-BR') : '—';
        const cri = s.created_at ? new Date(s.created_at).toLocaleDateString('pt-BR') : '—';
        const badge = own ? '<span class="bdg" style="background:rgba(251,191,36,.15);color:#FBBF24">Owner</span>' :
            s.status==='blocked' ? '<span class="bdg bdg-atrasado">Bloqueado</span>' :
            venc ? '<span class="bdg bdg-pendente">Vencido</span>' : '<span class="bdg bdg-pago">Ativo</span>';
        const em = s.email.replace(/'/g, "\\'");
        const btns = own ? '<span style="font-size:11px;color:var(--t3)">Ilimitado</span>' :
            '<div class="acts">' +
            (s.status==='active'&&!venc
                ? '<button class="btn brd sm" onclick="admBlock(\'' + em + '\')">Bloquear</button>'
                : '<button class="btn bgd sm" onclick="admUnblock(\'' + em + '\')">Ativar</button>') +
            '<button class="btn bpd sm" onclick="admRenew(\'' + em + '\')">Renovar</button>' +
            '<button class="btn bh sm" onclick="admDelete(\'' + em + '\')">Excluir</button></div>';
        return '<tr><td><strong>'+s.email+'</strong></td><td>'+(s.plan||'—')+'</td><td>'+badge+'</td><td>'+exp+'</td><td>'+cri+'</td><td>'+btns+'</td></tr>';
    }).join('');
}
async function admAddSub() {
    const email = (document.getElementById('admEmail')||{}).value||'';
    const plan  = (document.getElementById('admPlano')||{}).value||'mensal';
    const exp   = (document.getElementById('admExpires')||{}).value||'';
    if (!email.trim() || !exp) { try{toast('Preencha e-mail e vencimento','err');}catch(e){} return; }
    try {
        const { error } = await _supabase.from('subscriptions').upsert(
            { email: email.trim(), status:'active', plan, expires_at: new Date(exp).toISOString(), updated_at: new Date().toISOString() },
            { onConflict:'email' }
        );
        if (error) throw error;
        try{toast('Assinatura ativada!');}catch(e){}
        if(document.getElementById('admEmail')) document.getElementById('admEmail').value='';
        if(document.getElementById('admExpires')) document.getElementById('admExpires').value='';
        await admLoad();
    } catch(e) { try{toast('Erro: '+e.message,'err');}catch(ex){} }
}
async function admBlock(email) {
    if (!confirm('Bloquear '+email+'?')) return;
    await _supabase.from('subscriptions').update({status:'blocked',updated_at:new Date().toISOString()}).eq('email',email);
    try{toast(email+' bloqueado');}catch(e){} await admLoad();
}
async function admUnblock(email) {
    await _supabase.from('subscriptions').update({status:'active',updated_at:new Date().toISOString()}).eq('email',email);
    try{toast(email+' ativado');}catch(e){} await admLoad();
}
async function admRenew(email) {
    const days = prompt('Renovar por quantos dias?','30');
    if (!days||isNaN(days)) return;
    const sub = _admSubs.find(function(s){return s.email===email;});
    const base = sub&&sub.expires_at&&new Date(sub.expires_at)>new Date() ? new Date(sub.expires_at) : new Date();
    base.setDate(base.getDate()+parseInt(days));
    await _supabase.from('subscriptions').update({status:'active',expires_at:base.toISOString(),updated_at:new Date().toISOString()}).eq('email',email);
    try{toast(email+' renovado '+days+' dias');}catch(e){} await admLoad();
}
async function admDelete(email) {
    if (!confirm('Excluir '+email+'?')) return;
    await _supabase.from('subscriptions').delete().eq('email',email);
    try{toast(email+' excluído');}catch(e){} await admLoad();
}
