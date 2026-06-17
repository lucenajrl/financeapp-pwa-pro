// FinanceApp Pro — Supabase Logic
// Supabase: apenas Auth e verificação de assinatura
// Dados: salvos localmente via localStorage (S.s / S.so do index.html)

let _currentUser = null;
const ADMIN_EMAIL = 'jardsonlucena97@gmail.com';
const TRIAL_DURATION_MS = 5 * 60 * 1000; // 5 minutos
let _trialStartTime = null;
let _trialInterval = null;

// ── AUTH ──
async function initAuth() {
    try {
        const { data: { session } } = await _supabase.auth.getSession();
        if (session?.user) {
            _currentUser = session.user;
            showApp();
        } else {
            showAuth();
        }
    } catch(err) {
        console.error('Erro auth:', err);
        showAuth();
    }

    _supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
            _currentUser = session.user;
            showApp();
        } else if (event === 'SIGNED_OUT') {
            _currentUser = null;
            showAuth();
        }
    });
}

function showAuth() {
    const s = document.getElementById('authScreen');
    if (s) s.classList.remove('hide');
}

function showApp() {
    const s = document.getElementById('authScreen');
    if (s) s.classList.add('hide');

    // Preencher nome e email nas configs se ainda não preenchido
    if (!CF.nome) {
        CF.nome = _currentUser.user_metadata?.nome || _currentUser.email.split('@')[0];
        if (typeof S !== 'undefined') S.so('fa_cf', CF);
    }
    if (!CF.email) {
        CF.email = _currentUser.email;
        if (typeof S !== 'undefined') S.so('fa_cf', CF);
    }

    updUser();

    // Verificar admin e assinatura
    setTimeout(() => { checkAdmin(); if(typeof checkAdminUI==='function') checkAdminUI(); }, 200);
    setTimeout(() => { checkAdmin(); if(typeof checkAdminUI==='function') checkAdminUI(); }, 800);

    go('dashboard');

    // Garantir que os cards apareçam corretamente
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (typeof rDash === 'function') rDash();
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });
    });
    setTimeout(() => { if (typeof rDash === 'function') rDash(); }, 500);

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && typeof rDash === 'function') setTimeout(rDash, 150);
    }, { once: true });

    toast('Bem-vindo de volta! 👋');
}

// ── FUNÇÕES DE AUTH ──
async function authLogin() {
    const email = document.getElementById('loginEmail')?.value.trim();
    const password = document.getElementById('loginPass')?.value;
    if (!email || !password) { authShowErr('Preencha todos os campos.'); return; }
    const { error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) authShowErr('E-mail ou senha incorretos.');
}

async function authCadastro() {
    const nome = document.getElementById('cadNome')?.value.trim();
    const email = document.getElementById('cadEmail')?.value.trim();
    const password = document.getElementById('cadPass')?.value;
    const pass2 = document.getElementById('cadPass2')?.value;
    if (!nome || !email || !password) { authShowErr('Preencha todos os campos.'); return; }
    if (password !== pass2) { authShowErr('As senhas não coincidem.'); return; }
    const { error } = await _supabase.auth.signUp({
        email, password,
        options: { data: { nome } }
    });
    if (error) authShowErr('Erro: ' + error.message);
    else { toast('Cadastro realizado! Faça login.'); authToggle('login'); }
}

async function authSair() {
    if (!confirm('Deseja sair da sua conta?')) return;
    _currentUser = null;
    if (_trialInterval) { clearInterval(_trialInterval); _trialInterval = null; }
    await _supabase.auth.signOut();
    location.reload();
}

// ── ADMIN ──
function checkAdmin() {
    const adminBtn = document.getElementById('adminBtn');
    if (!_currentUser) { if(adminBtn) adminBtn.style.display='none'; return; }

    if (_currentUser.email === ADMIN_EMAIL) {
        if (adminBtn) {
            adminBtn.style.display = 'flex';
            adminBtn.style.visibility = 'visible';
            adminBtn.style.opacity = '1';
            adminBtn.style.pointerEvents = 'auto';
        }
        return; // Owner: sem trial
    }

    // Verificar assinatura no Supabase
    _supabase.from('subscriptions')
        .select('*')
        .eq('email', _currentUser.email)
        .single()
        .then(({ data }) => {
            if (adminBtn) adminBtn.style.display = 'none';
            if (data) {
                if (data.status === 'blocked') { showPaymentScreen(); return; }
                if (data.expires_at && new Date(data.expires_at) < new Date()) { showPaymentScreen(); return; }
                if (data.status === 'active') return; // Assinatura ativa
            }
            // Sem assinatura válida — iniciar trial
            initTrialTimer();
        })
        .catch(() => initTrialTimer());
}

// ── TRIAL ──
function initTrialTimer() {
    if (!_currentUser || _currentUser.email === ADMIN_EMAIL) return;
    if (_trialInterval) return; // já rodando
    const key = 'trial_start_' + _currentUser.id;
    const saved = localStorage.getItem(key);
    _trialStartTime = saved ? parseInt(saved) : Date.now();
    if (!saved) localStorage.setItem(key, _trialStartTime.toString());
    _trialInterval = setInterval(checkTrialExpiration, 5000);
}

function checkTrialExpiration() {
    if (!_currentUser || _currentUser.email === ADMIN_EMAIL) return;
    if (document.getElementById('paymentScreen')) return;
    if (Date.now() - _trialStartTime >= TRIAL_DURATION_MS) {
        clearInterval(_trialInterval);
        showPaymentScreen();
    }
}

function showPaymentScreen() {
    const main = document.querySelector('main');
    if (main) main.style.display = 'none';
    if (document.getElementById('paymentScreen')) return;

    const userEmail = _currentUser?.email || '';
    const waMsg = encodeURIComponent(
        `Olá! Quero assinar o *FinanceApp Pro*. 🚀

Meu e-mail de cadastro: *${userEmail}*

Por favor, me informe os planos disponíveis e como realizar o pagamento.`
    );
    const waLink = `https://api.whatsapp.com/send?phone=5588982146483&text=${waMsg}`;

    const div = document.createElement('div');
    div.id = 'paymentScreen';
    div.style.cssText = 'position:fixed;inset:0;background:#05070F;display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;font-family:Inter,sans-serif;';
    div.innerHTML = `
        <div style="background:#0D1526;border:1px solid rgba(79,142,247,.25);border-radius:20px;padding:32px 28px;max-width:420px;width:100%;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,.8);">
            <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,rgba(79,142,247,.2),rgba(139,92,246,.2));border:1px solid rgba(79,142,247,.3);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
                <svg viewBox="0 0 24 24" style="width:28px;height:28px;stroke:#4F8EF7;fill:none;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <h2 style="font-size:22px;font-weight:800;color:#F1F5F9;margin-bottom:8px">Período gratuito encerrado</h2>
            <p style="color:#94A3B8;font-size:13px;margin-bottom:24px;line-height:1.6">Você utilizou seus <strong style="color:#E2E8F0">5 minutos</strong> de acesso gratuito. Para continuar, assine e tenha acesso ilimitado.</p>
            <div style="background:#111D35;border:1px solid rgba(79,142,247,.15);border-radius:12px;padding:16px;margin-bottom:24px;text-align:left;">
                <div style="font-size:11px;color:#64748B;margin-bottom:12px;text-transform:uppercase;letter-spacing:.8px;font-weight:700">O que você tem acesso</div>
                ${['Gestão completa de vendas e clientes','Controle financeiro e relatórios','Comprovantes profissionais no WhatsApp','Contas a pagar e a receber','Estoque e ranking de produtos','Suporte via WhatsApp'].map(item =>
                    `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:12px;color:#CBD5E1">
                        <svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:#22C55E;fill:none;stroke-width:2.5;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>${item}
                    </div>`
                ).join('')}
            </div>
            <div style="background:rgba(79,142,247,.08);border:1px solid rgba(79,142,247,.2);border-radius:10px;padding:12px 16px;margin-bottom:20px;text-align:left;">
                <div style="font-size:10px;color:#64748B;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Seu e-mail de cadastro</div>
                <div style="font-size:13px;color:#93C5FD;font-weight:600">${userEmail}</div>
            </div>
            <button onclick="window.open('${waLink}','_blank')" style="width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;font-weight:700;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:10px;font-family:Inter,sans-serif">
                <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.413A9.953 9.953 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
                Quero assinar — falar no WhatsApp
            </button>
            <button onclick="authSair()" style="width:100%;padding:11px;border-radius:10px;border:1px solid rgba(239,68,68,.3);background:transparent;color:#EF4444;font-weight:600;cursor:pointer;font-size:13px;font-family:Inter,sans-serif">Sair da conta</button>
            <p style="font-size:11px;color:#475569;margin-top:16px;line-height:1.5">Ao clicar, você será direcionado ao WhatsApp com seus dados preenchidos automaticamente.</p>
        </div>
    `;
    document.body.appendChild(div);
}

// Painel ADM
let _admSubs = [];
async function admLoad() {
    admCards();
    document.getElementById('admTbody').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--t3)">Carregando...</td></tr>';
    try {
        if (typeof _supabase === 'undefined' || !_supabase) {
            document.getElementById('admTbody').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--rd)">Supabase não conectado.</td></tr>';
            return;
        }
        const { data, error } = await _supabase.from('subscriptions').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        _admSubs = data || [];
        admRender(); admCards();
    } catch(e) {
        document.getElementById('admTbody').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--rd)">Erro ao carregar. Verifique a tabela subscriptions.</td></tr>';
    }
}

function admFilter() { admRender(); }
function setAdmPlano(val) {
    document.getElementById('admPlano').value = val;
    ['mensal','trimestral','semestral','anual'].forEach(p => {
        const b = document.getElementById('admp_' + p);
        if (b) b.classList.toggle('on', p === val);
    });
}
function admCards() {
    const el = document.getElementById('admCards');
    if (!el) return;
    const ativos = _admSubs.filter(s => s.status === 'active' && (!s.expires_at || new Date(s.expires_at) > new Date())).length;
    const bloqueados = _admSubs.filter(s => s.status === 'blocked').length;
    const vencidos = _admSubs.filter(s => s.status === 'active' && s.expires_at && new Date(s.expires_at) < new Date()).length;
    el.innerHTML = `
        <div class="card"><div class="ch"><div class="cl">Total</div><div class="ci ib"><span class="lci"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span></div></div><div class="cv">${_admSubs.length}</div><div class="cs">cadastrados</div></div>
        <div class="card"><div class="ch"><div class="cl">Ativos</div><div class="ci ig"><span class="lci"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></span></div></div><div class="cv cg">${ativos}</div><div class="cs up">▲ pagantes</div></div>
        <div class="card"><div class="ch"><div class="cl">Vencidos</div><div class="ci iy"><span class="lci"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></span></div></div><div class="cv cy">${vencidos}</div><div class="cs wn">● renovação pendente</div></div>
        <div class="card"><div class="ch"><div class="cl">Bloqueados</div><div class="ci ir"><span class="lci"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></span></div></div><div class="cv cr">${bloqueados}</div><div class="cs dn">● sem acesso</div></div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
function admRender() {
    const search = (document.getElementById('admSearch')?.value || '').toLowerCase();
    const subs = _admSubs.filter(s => !search || s.email.toLowerCase().includes(search));
    if (!subs.length) { document.getElementById('admTbody').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--t3)">Nenhum encontrado</td></tr>'; return; }
    document.getElementById('admTbody').innerHTML = subs.map(s => {
        const isOwner = s.email === ADMIN_EMAIL;
        const vencido = s.expires_at && new Date(s.expires_at) < new Date();
        const expStr = s.expires_at ? new Date(s.expires_at).toLocaleDateString('pt-BR') : '—';
        const criadoStr = s.created_at ? new Date(s.created_at).toLocaleDateString('pt-BR') : '—';
        const badge = isOwner ? '<span class="bdg" style="background:rgba(251,191,36,.15);color:#FBBF24">👑 Owner</span>' : s.status === 'blocked' ? '<span class="bdg bdg-atrasado">Bloqueado</span>' : vencido ? '<span class="bdg bdg-pendente">Vencido</span>' : '<span class="bdg bdg-pago">Ativo</span>';
        const acoes = isOwner ? '<span style="font-size:11px;color:var(--t3)">Acesso ilimitado</span>' : `<div class="acts">${s.status==='active'&&!vencido?`<button class="btn brd sm" onclick="admBlock('${s.email}')">Bloquear</button>`:`<button class="btn bgd sm" onclick="admUnblock('${s.email}')">Ativar</button>`}<button class="btn bpd sm" onclick="admRenew('${s.email}')">Renovar</button><button class="btn bh sm" onclick="admDelete('${s.email}')">Excluir</button></div>`;
        return `<tr><td><strong>${s.email}</strong></td><td>${s.plan||'—'}</td><td>${badge}</td><td style="${vencido?'color:var(--rd)':''}">${expStr}</td><td>${criadoStr}</td><td>${acoes}</td></tr>`;
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
        toast('Assinatura de ' + email + ' ativada!');
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
    const sub = _admSubs.find(s => s.email === email);
    const base = sub?.expires_at && new Date(sub.expires_at) > new Date() ? new Date(sub.expires_at) : new Date();
    base.setDate(base.getDate() + parseInt(days));
    await _supabase.from('subscriptions').update({ status: 'active', expires_at: base.toISOString(), updated_at: new Date().toISOString() }).eq('email', email);
    toast(email + ' renovado por ' + days + ' dias'); await admLoad();
}
async function admDelete(email) { if (!confirm('Excluir permanentemente ' + email + '?')) return; await _supabase.from('subscriptions').delete().eq('email', email); toast(email + ' excluído'); await admLoad(); }

// Inicializar
window.addEventListener('load', () => { initAuth(); });
