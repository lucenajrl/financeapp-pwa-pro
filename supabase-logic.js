
// Configuração e Lógica do Supabase para FinanceApp Pro
// Configuração e Lógica do Supabase para FinanceApp Pro
// Usar as variáveis já definidas no supabase-config.js
const _db = typeof _supabase !== 'undefined' ? _supabase : supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Estado Global de Autenticação
let _currentUser = null;
let _isSyncing = false;
let _isLoaded = false;

// Inicializar Autenticação
async function initAuth() {
    try {
        // Sempre verificar a sessão do Supabase primeiro
        const { data: { session }, error } = await _db.auth.getSession();
        
        if (session && session.user) {
            _currentUser = session.user;
            // Limpar dados globais antes de carregar os novos
            V=[]; M=[]; C=[]; FAT=[]; E=[]; P=[]; CF={}; CL={};
            await loadUserData();
            showApp();
        } else {
            // Sem sessão - mostrar tela de login
            _currentUser = null;
            localStorage.clear();
            sessionStorage.clear();
            V=[]; M=[]; C=[]; FAT=[]; E=[]; P=[]; CF={}; CL={};
            showAuth();
        }
    } catch (err) {
        console.error('Erro ao inicializar auth:', err);
        showAuth();
    }

    // Escutar mudanças na auth
    _db.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
            _currentUser = session.user;
            localStorage.clear();
            sessionStorage.clear();
            V=[]; M=[]; C=[]; FAT=[]; E=[]; P=[]; CF={}; CL={};
            await loadUserData();
            showApp();
        } else if (event === 'SIGNED_OUT') {
            _currentUser = null;
            localStorage.clear();
            sessionStorage.clear();
            V=[]; M=[]; C=[]; FAT=[]; E=[]; P=[]; CF={}; CL={};
            showAuth();
        }
    });
}

// Mostrar Telas
function showAuth() {
    document.getElementById('authScreen').classList.remove('hide');
}

function showApp() {
    document.getElementById('authScreen').classList.add('hide');
    CF.nome = _currentUser.user_metadata?.nome || _currentUser.email.split('@')[0];
    CF.email = _currentUser.email;
    updUser();
    setTimeout(() => { checkAdmin(); if(typeof checkAdminUI==='function') checkAdminUI(); }, 200);
    setTimeout(() => { checkAdmin(); if(typeof checkAdminUI==='function') checkAdminUI(); }, 800);
    // initTrialTimer é chamado pelo checkAdmin após verificar assinatura
    go('dashboard');
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

// Funções de Auth (Substituindo as originais)
async function authLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPass').value;

    if (!email || !password) {
        authShowErr('Preencha todos os campos.');
        return;
    }

    const { data, error } = await _db.auth.signInWithPassword({ email, password });
    if (error) {
        authShowErr('Erro: ' + error.message);
    }
}

async function authCadastro() {
    const nome = document.getElementById('cadNome').value.trim();
    const email = document.getElementById('cadEmail').value.trim();
    const password = document.getElementById('cadPass').value;
    const pass2 = document.getElementById('cadPass2').value;

    if (!nome || !email || !password) {
        authShowErr('Preencha todos os campos.');
        return;
    }
    if (password !== pass2) {
        authShowErr('As senhas não coincidem.');
        return;
    }

    const { data, error } = await _db.auth.signUp({
        email,
        password,
        options: {
            data: { nome: nome }
        }
    });

    if (error) {
        authShowErr('Erro: ' + error.message);
    } else {
        toast('Cadastro realizado! Verifique seu e-mail ou faça login.');
        authToggle('login');
    }
}

async function authSair() {
    if (confirm('Deseja sair da sua conta?')) {
        // Limpar todos os dados locais
        localStorage.clear();
        sessionStorage.clear();
        
        // Resetar variáveis globais
        V = [];
        M = [];
        C = [];
        P = [];
        CF = {};
        _currentUser = null;
        
        // Fazer logout no Supabase
        await _db.auth.signOut();
        
        // Recarregar a página
        location.reload();
    }
}

// Sincronização de Dados
async function saveUserData() {
    if (!_currentUser || _isSyncing || !_isLoaded) return;
    _isSyncing = true;
    const payload = {
        user_id: _currentUser.id,
        data_v: V,
        data_m: M,
        data_c: C,
        data_fat: FAT,
        data_e: E,
        data_cl: CL,
        data_cf: CF,
        updated_at: new Date().toISOString()
    };
    const { error } = await _db.from('user_data').upsert(payload, { onConflict: 'user_id' });
    if (error) console.error('Erro ao salvar:', error);
    _isSyncing = false;
}

async function loadUserData() {
    if (!_currentUser) return;
    _isLoaded = false;

    const { data, error } = await _db
        .from('user_data')
        .select('*')
        .eq('user_id', _currentUser.id)
        .single();

    if (data) {
        V = data.data_v || [];
        M = data.data_m || [];
        C = data.data_c || [];
        FAT = data.data_fat || [];
        E = data.data_e || [];
        CL = data.data_cl || {};
        P = data.data_p || [];
        Object.assign(CF, data.data_cf || {});
        CF.email = _currentUser.email;
        if (!CF.nome) CF.nome = _currentUser.user_metadata?.nome || _currentUser.email.split('@')[0];
        
        // Salvar localmente sem disparar o sync novamente
        if (typeof S !== 'undefined' && S._origSave) {
            S._origSave('fa_v', V);
            S._origSave('fa_m', M);
            S._origSave('fa_c', C);
            S._origSave('fa_fat', FAT);
            S._origSave('fa_e', E);
            S._origSave('fa_cl', CL);
            S._origSave('fa_cf', CF);
        }
        
        if (typeof updUser === 'function') updUser();
        if (typeof rDash === 'function') {
            requestAnimationFrame(() => requestAnimationFrame(() => rDash()));
        }
        _isLoaded = true;
    } else {
        _isLoaded = true;
        V = []; M = []; C = []; FAT = []; E = []; P = []; CL = {};
        CF = {
            nome: _currentUser.user_metadata?.nome || _currentUser.email.split('@')[0],
            email: _currentUser.email,
            emp: '', wh: '', insta: '', meta: '0', msgAniv: ''
        };
        await _db.from('user_data').insert({
            user_id: _currentUser.id,
            data_v: [], data_m: [], data_c: [], data_fat: [],
            data_e: [], data_cl: {}, data_p: [],
            data_cf: CF
        });
    }
}

// Sobrescrever funções de salvamento local para usar Supabase
function setupSync() {
    if (typeof S === 'undefined') {
        setTimeout(setupSync, 100);
        return;
    }
    
    const originalSave = S.s.bind(S);
    S._origSave = originalSave;
    S.s = function(key, val) {
        originalSave(key, val);
        if (key === 'fa_v') V = val;
        if (key === 'fa_m') M = val;
        if (key === 'fa_c') C = val;
        if (key === 'fa_fat') FAT = val;
        if (key === 'fa_e') E = val;
        if (key === 'fa_cl') CL = val;
        if (key === 'fa_p') P = val;
        if (key === 'fa_cf') Object.assign(CF, val);
        saveUserData();
    };

    const originalSaveObj = S.so.bind(S);
    S.so = function(key, val) {
        originalSaveObj(key, val);
        if (key === 'fa_cf') Object.assign(CF, val);
        if (key === 'fa_cl') CL = val;
        saveUserData();
    };
}
setupSync();

// Painel ADM (Apenas para o dono)
async function checkAdmin() {
    const adminEmail = 'jardsonlucena97@gmail.com';
    const adminBtn = document.getElementById('adminBtn');
    
    if (!_currentUser) {
        if (adminBtn) adminBtn.style.display = 'none';
        return;
    }

    if (_currentUser.email === adminEmail) {
        if (adminBtn) {
            adminBtn.style.display = 'flex';
            adminBtn.style.visibility = 'visible';
            adminBtn.style.opacity = '1';
            adminBtn.style.pointerEvents = 'auto';
        }
    } else {
        // Verificar se o usuário tem uma assinatura ativa
        try {
            const { data, error } = await _db
                .from('subscriptions')
                .select('status, expires_at')
                .eq('email', _currentUser.email)
                .single();

            if (data) {
                if (data.status === 'blocked') {
                    // Bloqueado — mostrar tela de pagamento imediatamente
                    showPaymentScreen();
                    return;
                } else if (data.expires_at && new Date(data.expires_at) < new Date()) {
                    // Assinatura vencida — mostrar tela de pagamento
                    showPaymentScreen();
                    return;
                } else if (data.status === 'active') {
                    // Assinatura ativa — acesso liberado, sem trial
                    if (adminBtn) adminBtn.style.display = 'none';
                    return;
                }
            }
            // Sem assinatura ou dados não encontrados — iniciar trial
            initTrialTimer();
        } catch (e) {
            // Erro ao verificar — iniciar trial por segurança
            initTrialTimer();
        }
        
        if (adminBtn) adminBtn.style.display = 'none';
    }
}

// Inicializar ao carregar
window.addEventListener('load', () => {
    initAuth().then(() => {
        checkAdmin();
    });
});


// ═══ SISTEMA DE DEGUSTAÇÃO (30 MINUTOS) ═══
let _trialStartTime = null;
const TRIAL_DURATION_MS = 5 * 60 * 1000; // 5 minutos em milissegundos
const ADMIN_EMAIL = 'jardsonlucena97@gmail.com';

function initTrialTimer() {
    if (_currentUser && _currentUser.email === ADMIN_EMAIL) {
        // Admin tem acesso ilimitado
        return;
    }
    
    // Carregar tempo de início da sessão do localStorage
    const storageKey = `trial_start_${_currentUser.id}`;
    const savedStartTime = localStorage.getItem(storageKey);
    
    if (savedStartTime) {
        _trialStartTime = parseInt(savedStartTime);
    } else {
        _trialStartTime = Date.now();
        localStorage.setItem(storageKey, _trialStartTime.toString());
    }
    
    // Iniciar verificação a cada 5 segundos
    setInterval(checkTrialExpiration, 5000);
}

function checkTrialExpiration() {
    if (!_currentUser || _currentUser.email === ADMIN_EMAIL) return;
    if (document.getElementById('paymentScreen')) return; // já exibindo
    
    const elapsedTime = Date.now() - _trialStartTime;
    const remainingTime = TRIAL_DURATION_MS - elapsedTime;
    
    if (remainingTime <= 0) {
        showPaymentScreen();
    }
}

function showPaymentScreen() {
    const main = document.querySelector('main');
    if (main) main.style.display = 'none';

    const userEmail = _currentUser?.email || '';
    const waMsg = encodeURIComponent(
        `Olá! Quero assinar o *FinanceApp Pro*. 🚀\n\nMeu e-mail de cadastro: *${userEmail}*\n\nPor favor, me informe os planos disponíveis e como realizar o pagamento.`
    );
    const waLink = `https://api.whatsapp.com/send?phone=5588982146483&text=${waMsg}`;

    const paymentScreen = document.createElement('div');
    paymentScreen.id = 'paymentScreen';
    paymentScreen.style.cssText = 'position:fixed;inset:0;background:#05070F;display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;font-family:Inter,sans-serif;';

    paymentScreen.innerHTML = `
        <div style="background:#0D1526;border:1px solid rgba(79,142,247,.25);border-radius:20px;padding:32px 28px;max-width:420px;width:100%;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,.8);">

            <!-- Ícone + título -->
            <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,rgba(79,142,247,.2),rgba(139,92,246,.2));border:1px solid rgba(79,142,247,.3);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
                <svg viewBox="0 0 24 24" style="width:28px;height:28px;stroke:#4F8EF7;fill:none;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <h2 style="font-size:22px;font-weight:800;color:#F1F5F9;margin-bottom:8px;font-family:Syne,sans-serif">Período gratuito encerrado</h2>
            <p style="color:#94A3B8;font-size:13px;margin-bottom:24px;line-height:1.6">Você utilizou seus <strong style="color:#E2E8F0">5 minutos</strong> de acesso gratuito ao FinanceApp Pro. Para continuar, assine e tenha acesso ilimitado.</p>

            <!-- O que você ganha -->
            <div style="background:#111D35;border:1px solid rgba(79,142,247,.15);border-radius:12px;padding:16px;margin-bottom:24px;text-align:left;">
                <div style="font-size:11px;color:#64748B;margin-bottom:12px;text-transform:uppercase;letter-spacing:.8px;font-weight:700">O que você tem acesso</div>
                ${['Gestão completa de vendas e clientes','Controle financeiro e relatórios','Comprovantes profissionais no WhatsApp','Contas a pagar e a receber','Estoque e ranking de produtos','Suporte via WhatsApp'].map(item =>
                    `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:12px;color:#CBD5E1">
                        <svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:#22C55E;fill:none;stroke-width:2.5;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>
                        ${item}
                    </div>`
                ).join('')}
            </div>

            <!-- Email do usuário -->
            <div style="background:rgba(79,142,247,.08);border:1px solid rgba(79,142,247,.2);border-radius:10px;padding:12px 16px;margin-bottom:20px;text-align:left;">
                <div style="font-size:10px;color:#64748B;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Seu e-mail de cadastro</div>
                <div style="font-size:13px;color:#93C5FD;font-weight:600">${userEmail}</div>
            </div>

            <!-- Botão principal WhatsApp -->
            <button onclick="window.open('${waLink}','_blank')" style="width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;font-weight:700;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:10px;font-family:Inter,sans-serif">
                <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.413A9.953 9.953 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
                Quero assinar — falar no WhatsApp
            </button>

            <!-- Botão sair -->
            <button onclick="authSair()" style="width:100%;padding:11px;border-radius:10px;border:1px solid rgba(239,68,68,.3);background:transparent;color:#EF4444;font-weight:600;cursor:pointer;font-size:13px;font-family:Inter,sans-serif">
                Sair da conta
            </button>

            <p style="font-size:11px;color:#475569;margin-top:16px;line-height:1.5">Ao clicar em "Quero assinar", você será direcionado ao WhatsApp com seus dados preenchidos automaticamente.</p>
        </div>
    `;

    document.body.appendChild(paymentScreen);
}
