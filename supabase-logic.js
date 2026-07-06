// FinanceApp Pro — Supabase Data Sync
// Auth: feito inline no index.html
// Este arquivo: salvar/carregar dados + ADM + Trial

let _currentUser = null;
let _isSyncing = false;
let _isLoaded = false;
const ADMIN_EMAIL = 'jardsonlucena97@gmail.com';
const TRIAL_DURATION_MS = 5 * 60 * 1000;
let _trialStartTime = null;
let _trialInterval = null;

// Pegar usuário atual do Supabase
async function _getUser() {
    try {
        const { data } = await _supabase.auth.getUser();
        return data?.user || null;
    } catch(e) { return null; }
}

// ── SAVE NO SUPABASE ──
async function saveUserData() {
    if (_isSyncing || !_isLoaded) return;
    const user = _currentUser || await _getUser();
    if (!user) return;
    _isSyncing = true;
    try {
        await _supabase.from('user_data').upsert({
            user_email: user.email,
            data_v: typeof V !== 'undefined' ? V : [],
            data_m: typeof M !== 'undefined' ? M : [],
            data_c: typeof C !== 'undefined' ? C : [],
            data_fat: typeof FAT !== 'undefined' ? FAT : [],
            data_e: typeof E !== 'undefined' ? E : [],
            data_p: typeof P !== 'undefined' ? P : [],
            data_cl: typeof CL !== 'undefined' ? CL : {},
            data_cf: typeof CF !== 'undefined' ? CF : {},
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_email' });
    } catch(err) {
        console.error('saveUserData erro:', err);
    }
    _isSyncing = false;
}

// ── LOAD DO SUPABASE ──
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
            // Atualizar variáveis globais E localStorage
            const updates = {
                fa_v: data.data_v || [],
                fa_m: data.data_m || [],
                fa_c: data.data_c || [],
                fa_fat: data.data_fat || [],
                fa_e: data.data_e || [],
                fa_p: data.data_p || [],
            };
            Object.entries(updates).forEach(([k, v]) => {
                try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {}
            });
            try { localStorage.setItem('fa_cl', JSON.stringify(data.data_cl || {})); } catch(e) {}
            try { localStorage.setItem('fa_cf', JSON.stringify(data.data_cf || {})); } catch(e) {}
            // Atualizar variáveis globais do app
            try { V = data.data_v || []; } catch(e) {}
            try { M = data.data_m || []; } catch(e) {}
            try { C = data.data_c || []; } catch(e) {}
            try { FAT = data.data_fat || []; } catch(e) {}
            try { E = data.data_e || []; } catch(e) {}
            try { P = data.data_p || []; } catch(e) {}
            try { CL = data.data_cl || {}; } catch(e) {}
            try { Object.assign(CF, data.data_cf || {}); } catch(e) {}
        } else {
            // Novo usuário — criar registro
            await _supabase.from('user_data').insert({
                user_email: user.email,
                data_v: [], data_m: [], data_c: [], data_fat: [],
                data_e: [], data_p: [], data_cl: {}, data_cf: {}
            });
        }
    } catch(err) {
        console.error('loadUserData erro:', err);
    }
    _isLoaded = true;
}

// ── INTERCEPTAR S.s PARA SALVAR NO SUPABASE ──
function _setupSaveInterceptor() {
    if (!S || !S.s || S.__intercepted) return;
    S.__intercepted = true;
    const _orig = S.s.bind(S);
    S.s = function(key, val) {
        _orig(key, val);
        if (key === 'fa_v') { try { V = val; } catch(e) {} }
        else if (key === 'fa_m') { try { M = val; } catch(e) {} }
        else if (key === 'fa_c') { try { C = val; } catch(e) {} }
        else if (key === 'fa_fat') { try { FAT = val; } catch(e) {} }
        else if (key === 'fa_e') { try { E = val; } catch(e) {} }
        else if (key === 'fa_p') { try { P = val; } catch(e) {} }
        if (_isLoaded) saveUserData();
    };
    const _origSo = S.so.bind(S);
    S.so = function(key, val) {
        _origSo(key, val);
        if (key === 'fa_cl') { try { CL = val; } catch(e) {} }
        else if (key === 'fa_cf') { try { Object.assign(CF, val); } catch(e) {} }
        if (_isLoaded) saveUserData();
    };
}

// ── INICIALIZAR ──
window.addEventListener('load', async function() {
    _setupSaveInterceptor();

    // Pegar usuário logado
    const user = await _getUser();
    if (user) {
        _currentUser = user;
        await loadUserData();
        // Re-render após carregar dados do Supabase
        try { if (typeof rDash === 'function') setTimeout(rDash, 200); } catch(e) {}
        // Verificar admin e trial
        setTimeout(function() {
            try { checkAdmin(); } catch(e) {}
        }, 500);
    }

    // Auto-save a cada 2 minutos
    setInterval(function() { if (_isLoaded) saveUserData(); }, 2 * 60 * 1000);
    window.addEventListener('beforeunload', function() { if (_isLoaded) saveUserData(); });
});

// ── ADMIN ──
function checkAdmin() {
    const btn = document.getElementById('adminBtn');
    if (!btn) return;
    _supabase.auth.getUser().then(function(r) {
        const email = r.data?.user?.email;
        if (email === ADMIN_EMAIL) {
            btn.style.display = 'flex';
            btn.style.visibility = 'visible';
            btn.style.opacity = '1';
            // Verificar assinatura do owner no Supabase
            _isLoaded = true;
        } else if (email) {
            btn.style.display = 'none';
            // Verificar trial para não-admin
            _supabase.from('subscriptions').select('*').eq('email', email).maybeSingle().then(function(r2) {
                if (r2.data) {
                    if (r2.data.status === 'blocked') { showPaymentScreen(email); return; }
                    if (r2.data.expires_at && new Date(r2.data.expires_at) < new Date()) { showPaymentScreen(email); return; }
                    if (r2.data.status === 'active') { _isLoaded = true; return; }
                }
                initTrialTimer(email, r.data.user.id);
            });
        }
    });
}

// ── TRIAL ──
function initTrialTimer(email, userId) {
    if (_trialInterval) return;
    const key = 'trial_start_' + userId;
    const saved = localStorage.getItem(key);
    _trialStartTime = saved ? parseInt(saved) : Date.now();
    if (!saved) localStorage.setItem(key, _trialStartTime);
    _isLoaded = true;
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
    const waMsg = encodeURIComponent('Olá! Quero assinar o *FinanceApp Pro*. 🚀\n\nMeu e-mail: *' + email + '*');
    const waLink = 'https://api.whatsapp.com/send?phone=5588982146483&text=' + waMsg;
    const div = document.createElement('div');
    div.id = 'paymentScreen';
    div.style.cssText = 'position:fixed;inset:0;background:#05070F;display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;font-family:Inter,sans-serif;';
    div.innerHTML = '<div style="background:#0D1526;border:1px solid rgba(79,142,247,.25);border-radius:20px;padding:32px 28px;max-width:420px;width:100%;text-align:center;">' +
        '<h2 style="font-size:22px;font-weight:800;color:#F1F5F9;margin-bottom:12px">Período gratuito encerrado</h2>' +
        '<p style="color:#94A3B8;font-size:13px;margin-bottom:24px">Você utilizou seus 5 minutos de acesso gratuito.</p>' +
        '<div style="background:rgba(79,142,247,.08);border-radius:10px;padding:12px;margin-bottom:20px;">' +
        '<div style="font-size:11px;color:#64748B;margin-bottom:4px">Seu e-mail</div>' +
        '<div style="font-size:13px;color:#93C5FD;font-weight:600">' + email + '</div></div>' +
        '<button onclick="window.open(\'' + waLink + '\',\'_blank\')" style="width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:10px;">Quero assinar — WhatsApp</button>' +
        '<button onclick="authSair()" style="width:100%;padding:11px;border-radius:10px;border:1px solid rgba(239,68,68,.3);background:transparent;color:#EF4444;font-weight:600;cursor:pointer;font-size:13px;">Sair</button>' +
        '</div>';
    document.body.appendChild(div);
}

// ── PAINEL ADM ──
let _admSubs = [];
async function admLoad() {
    admCards();
    document.getElementById('admTbody').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--t3)">Carregando...</td></tr>';
    try {
        const { data, error } = await _supabase.from('subscriptions').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        _admSubs = data || [];
        admRender(); admCards();
    } catch(e) {
        document.getElementById('admTbody').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--rd)">Erro ao carregar.</td></tr>';
    }
}
function admFilter() { admRender(); }
function setAdmPlano(val) {
    document.getElementById('admPlano').value = val;
    ['mensal','trimestral','semestral','anual'].forEach(function(p) {
        const b = document.getElementById('admp_' + p);
        if (b) b.classList.toggle('on', p === val);
    });
}
function admCards() {
    const el = document.getElementById('admCards');
    if (!el) return;
    const ativos = _admSubs.filter(function(s){ return s.status==='active' && (!s.expires_at || new Date(s.expires_at) > new Date()); }).length;
    const bloqueados = _admSubs.filter(function(s){ return s.status==='blocked'; }).length;
    const vencidos = _admSubs.filter(function(s){ return s.status==='active' && s.expires_at && new Date(s.expires_at) < new Date(); }).length;
    el.innerHTML = '<div class="card"><div class="ch"><div class="cl">Total</div></div><div class="cv">' + _admSubs.length + '</div><div class="cs">cadastrados</div></div>' +
        '<div class="card"><div class="ch"><div class="cl">Ativos</div></div><div class="cv cg">' + ativos + '</div><div class="cs up">▲ pagantes</div></div>' +
        '<div class="card"><div class="ch"><div class="cl">Vencidos</div></div><div class="cv cy">' + vencidos + '</div><div class="cs wn">● pendente</div></div>' +
        '<div class="card"><div class="ch"><div class="cl">Bloqueados</div></div><div class="cv cr">' + bloqueados + '</div><div class="cs dn">● sem acesso</div></div>';
}
function admRender() {
    const search = (document.getElementById('admSearch') || {}).value || '';
    const subs = _admSubs.filter(function(s){ return !search || s.email.toLowerCase().includes(search.toLowerCase()); });
    if (!subs.length) { document.getElementById('admTbody').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--t3)">Nenhum encontrado</td></tr>'; return; }
    document.getElementById('admTbody').innerHTML = subs.map(function(s) {
        const isOwner = s.email === ADMIN_EMAIL;
        const vencido = s.expires_at && new Date(s.expires_at) < new Date();
        const expStr = s.expires_at ? new Date(s.expires_at).toLocaleDateString('pt-BR') : '—';
        const badge = isOwner ? '<span class="bdg" style="background:rgba(251,191,36,.15);color:#FBBF24">👑 Owner</span>' : s.status==='blocked' ? '<span class="bdg bdg-atrasado">Bloqueado</span>' : vencido ? '<span class="bdg bdg-pendente">Vencido</span>' : '<span class="bdg bdg-pago">Ativo</span>';
        const acoes = isOwner ? '<span style="font-size:11px;color:var(--t3)">Acesso ilimitado</span>' : '<div class="acts">' + (s.status==='active'&&!vencido ? '<button class="btn brd sm" onclick="admBlock(\'' + s.email + '\')">Bloquear</button>' : '<button class="btn bgd sm" onclick="admUnblock(\'' + s.email + '\')">Ativar</button>') + '<button class="btn bpd sm" onclick="admRenew(\'' + s.email + '\')">Renovar</button><button class="btn bh sm" onclick="admDelete(\'' + s.email + '\')">Excluir</button></div>';
        return '<tr><td><strong>' + s.email + '</strong></td><td>' + (s.plan||'—') + '</td><td>' + badge + '</td><td>' + expStr + '</td><td>' + (s.created_at ? new Date(s.created_at).toLocaleDateString('pt-BR') : '—') + '</td><td>' + acoes + '</td></tr>';
    }).join('');
}
async function admAddSub() {
    const email = document.getElementById('admEmail').value.trim();
    const plan = document.getElementById('admPlano').value;
    const expires = document.getElementById('admExpires').value;
    if (!email || !expires) { toast('Preencha e-mail e vencimento', 'err'); return; }
    try {
        const { error } = await _supabase.from('subscriptions').upsert({ email, status: 'active', plan, expires_at: new Date(expires).toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'email' });
        if (error) throw error;
        toast('Assinatura ativada!');
        document.getElementById('admEmail').value = '';
        document.getElementById('admExpires').value = '';
        await admLoad();
    } catch(e) { toast('Erro: ' + e.message, 'err'); }
}
async function admBlock(email) { if (!confirm('Bloquear ' + email + '?')) return; await _supabase.from('subscriptions').update({ status: 'blocked', updated_at: new Date().toISOString() }).eq('email', email); toast(email + ' bloqueado'); await admLoad(); }
async function admUnblock(email) { await _supabase.from('subscriptions').update({ status: 'active', updated_at: new Date().toISOString() }).eq('email', email); toast(email + ' ativado'); await admLoad(); }
async function admRenew(email) {
    const days = prompt('Renovar por quantos dias?', '30');
    if (!days || isNaN(days)) return;
    const sub = _admSubs.find(function(s){ return s.email === email; });
    const base = sub && sub.expires_at && new Date(sub.expires_at) > new Date() ? new Date(sub.expires_at) : new Date();
    base.setDate(base.getDate() + parseInt(days));
    await _supabase.from('subscriptions').update({ status: 'active', expires_at: base.toISOString(), updated_at: new Date().toISOString() }).eq('email', email);
    toast(email + ' renovado'); await admLoad();
}
async function admDelete(email) { if (!confirm('Excluir ' + email + '?')) return; await _supabase.from('subscriptions').delete().eq('email', email); toast(email + ' excluído'); await admLoad(); }
