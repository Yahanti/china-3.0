// ARQUIVO: server.js (Versão Final com Foco em Sessão e Proxy)

require('dotenv').config();

// 1. IMPORTAÇÕES
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

// 2. CONFIGURAÇÕES
const app = express();
const port = process.env.PORT || 3000;
const saltRounds = 10;

// 3. MIDDLEWARES
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// =================================================================
// 4. BANCO DE DADOS E SESSÃO (CONFIGURAÇÃO ROBUSTA PARA RENDER)
// =================================================================
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const sessionStore = new pgSession({
    pool: db,
    tableName: 'session'
});

// AVISO IMPORTANTE PARA O EXPRESS: "Confie no proxy do Render"
// Isso garante que o cookie 'secure' funcione corretamente.
app.set('trust proxy', 1); 

app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true, // MUDANÇA: 'true' força a criação de uma sessão
    cookie: { 
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000
    }
}));

// =================================================================
// 5. MIDDLEWARES DE AUTENTICAÇÃO (Com logs para depuração)
// =================================================================
const isLoggedIn = (req, res, next) => {
    console.log('[ISLOGGEDIN CHECK] Verificando acesso para:', req.originalUrl);
    console.log('[ISLOGGEDIN CHECK] Sessão atual:', req.session);

    if (req.session && req.session.userId) {
        console.log(`[ISLOGGEDIN CHECK] Acesso PERMITIDO para user ID: ${req.session.userId}`);
        next();
    } else {
        console.log(`[ISLOGGEDIN CHECK] Acesso NEGADO. Redirecionando para login.`);
        res.redirect('/login.html');
    }
};

// ... (O resto do seu código, como o middleware isAdmin, continua o mesmo)
const isAdmin = (req, res, next) => {
    if (req.session && req.session.isAdmin) { return next(); }
    res.status(403).json({ error: 'Acesso negado.' });
};


// =================================================================
// 6. ROTAS (Com salvamento explícito da sessão no login)
// =================================================================
// ... (Suas rotas públicas como app.get('/') aqui)

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await db.query("SELECT id, nickname, password_hash FROM recrutas WHERE email = $1 AND status = 'aprovado'", [email]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            if (await bcrypt.compare(password, user.password_hash)) {
                const adminResult = await db.query("SELECT id FROM admins WHERE username = $1", [user.nickname]);
                
                req.session.userId = user.id;
                req.session.nickname = user.nickname;
                req.session.isAdmin = adminResult.rows.length > 0;
                
                // MUDANÇA: Força o salvamento da sessão ANTES de responder
                return req.session.save(err => {
                    if (err) {
                        console.error("Erro ao salvar a sessão:", err);
                        return res.status(500).json({ success: false, message: 'Erro ao iniciar sessão.' });
                    }
                    console.log(`[LOGIN SUCCESS] Sessão para '${req.session.nickname}' salva! Redirecionando.`);
                    return res.json({ success: true, redirectUrl: '/dashboard.html' });
                });
            }
        }
        res.status(401).json({ success: false, message: 'Credenciais inválidas ou recrutamento não aprovado.' });
    } catch (error) {
        console.error("Erro CRÍTICO no /login:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// ... (Cole aqui TODAS as suas outras rotas: /recrutar, /logout, /api/..., etc.)


// =================================================================
// 7. INICIAR O SERVIDOR
// =================================================================
app.listen(port, () => {
    console.log(`Servidor da Facção China rodando na porta ${port}`);
});
