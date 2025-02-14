const express = require('express');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const PORT = 3000;
const app = express();

// Middleware para parsear JSON
app.use(express.json());

// Ruta para verificar y crear el archivo 'tareas.json' si no existe
const inicializarArchivo = (archivo) => {
    if (!fs.existsSync(archivo)) {
        fs.writeFileSync(archivo, '[]', 'utf8');
    }
};

// Inicialización de archivos JSON
inicializarArchivo('tareas.json');
inicializarArchivo('users.json');

// Función para leer archivos JSON
const leerArchivo = (archivo) => {
    try {
        const data = fs.readFileSync(archivo, 'utf8');
        return JSON.parse(data) || [];
    } catch (error) {
        return [];
    }
};

// Función para escribir en archivos JSON
const escribirArchivo = (archivo, data) => {
    fs.writeFileSync(archivo, JSON.stringify(data, null, 2), 'utf8');
};

// Middleware de autenticación
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Acceso denegado' });
    
    jwt.verify(token, 'secreto', (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Token inválido' });
        req.user = decoded;
        next();
    });
};

// Manejo de errores global
const errorHandler = (err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
};

// Rutas relacionadas con tareas
app.get('/tareas', authMiddleware, (req, res, next) => {
    try {
        const tareas = leerArchivo('tareas.json');
        res.json(tareas);
    } catch (error) {
        next(error);
    }
});

app.post('/tareas', authMiddleware, (req, res, next) => {
    try {
        const { titulo, descripcion } = req.body;
        if (!titulo || !descripcion) return res.status(400).json({ error: 'Faltan datos' });

        const tareas = leerArchivo('tareas.json');
        const nuevaTarea = { id: Date.now(), titulo, descripcion };
        tareas.push(nuevaTarea);
        escribirArchivo('tareas.json', tareas);

        res.status(201).json(nuevaTarea);
    } catch (error) {
        next(error);
    }
});

app.put('/tareas/:id', authMiddleware, (req, res, next) => {
    try {
        const { id } = req.params;
        const { titulo, descripcion } = req.body;
        const tareas = leerArchivo('tareas.json');
        const tarea = tareas.find(t => t.id == id);
        
        if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' });
        
        tarea.titulo = titulo || tarea.titulo;
        tarea.descripcion = descripcion || tarea.descripcion;
        escribirArchivo('tareas.json', tareas);

        res.json(tarea);
    } catch (error) {
        next(error);
    }
});

app.delete('/tareas/:id', authMiddleware, (req, res, next) => {
    try {
        const { id } = req.params;
        let tareas = leerArchivo('tareas.json');
        tareas = tareas.filter(t => t.id != id);
        escribirArchivo('tareas.json', tareas);
        res.json({ mensaje: 'Tarea eliminada' });
    } catch (error) {
        next(error);
    }
});

// Rutas de autenticación y usuario
app.post('/register', (req, res, next) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });

        const users = leerArchivo('users.json');
        if (users.find(u => u.username === username)) return res.status(400).json({ error: 'Usuario ya existe' });
        
        const hashedPassword = bcrypt.hashSync(password, 10);
        users.push({ username, password: hashedPassword });
        escribirArchivo('users.json', users);

        res.status(201).json({ mensaje: 'Usuario registrado' });
    } catch (error) {
        next(error);
    }
});

app.post('/login', (req, res, next) => {
    try {
        const { username, password } = req.body;
        const users = leerArchivo('users.json');
        const user = users.find(u => u.username === username);

        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        const token = jwt.sign({ username }, 'secreto', { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        next(error);
    }
});

// Middleware de manejo de errores
app.use(errorHandler);

// Arrancar el servidor
app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}!`);
});
