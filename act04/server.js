const express = require('express');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const PORT = 3000;
const app = express();
app.use(express.json());

// Servir archivos estáticos desde el mismo directorio
app.use(express.static(__dirname));

// Inicialización de archivos JSON
const inicializarArchivo = (archivo) => {
    if (!fs.existsSync(archivo)) fs.writeFileSync(archivo, '[]', 'utf8');
};

inicializarArchivo('productos.json');
inicializarArchivo('users.json');
inicializarArchivo('carritos.json');

// Funciones para manejar archivos JSON
const leerArchivo = (archivo) => {
    try {
        return JSON.parse(fs.readFileSync(archivo, 'utf8')) || [];
    } catch (error) {
        return [];
    }
};

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

// **Registro y Login**
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });

    const users = leerArchivo('users.json');
    if (users.find(u => u.username === username)) return res.status(400).json({ error: 'Usuario ya existe' });

    users.push({ username, password: bcrypt.hashSync(password, 10) });
    escribirArchivo('users.json', users);

    res.status(201).json({ mensaje: 'Usuario registrado' });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const users = leerArchivo('users.json');
    const user = users.find(u => u.username === username);

    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign({ username }, 'secreto', { expiresIn: '1h' });
    res.json({ token });
});

// **Gestión de productos**
app.get('/productos', (req, res) => {
    res.json(leerArchivo('productos.json'));
});

app.post('/productos', authMiddleware, (req, res) => {
    const { nombre, precio } = req.body;
    if (!nombre || precio == null) return res.status(400).json({ error: 'Faltan datos' });

    const productos = leerArchivo('productos.json');
    const nuevoProducto = { id: Date.now(), nombre, precio };
    productos.push(nuevoProducto);
    escribirArchivo('productos.json', productos);

    res.status(201).json(nuevoProducto);
});

// **Gestión del carrito**
app.get('/carrito', authMiddleware, (req, res) => {
    const carritos = leerArchivo('carritos.json');
    const carrito = carritos.find(c => c.username === req.user.username) || { productos: [] };
    res.json(carrito.productos);
});

app.post('/carrito', authMiddleware, (req, res) => {
    const { id } = req.body;
    const productos = leerArchivo('productos.json');
    const producto = productos.find(p => p.id == id);

    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    let carritos = leerArchivo('carritos.json');
    let carrito = carritos.find(c => c.username === req.user.username);

    if (!carrito) {
        carrito = { username: req.user.username, productos: [] };
        carritos.push(carrito);
    }

    // Verifica si el producto ya está en el carrito
    const productoEnCarrito = carrito.productos.find(p => p.id == id);
    if (productoEnCarrito) {
        productoEnCarrito.cantidad += 1; // Incrementa la cantidad si ya existe
    } else {
        producto.cantidad = 1; // Agrega el producto con cantidad 1 si no existe
        carrito.productos.push(producto);
    }

    escribirArchivo('carritos.json', carritos);
    res.status(201).json({ mensaje: 'Producto agregado al carrito', carrito: carrito.productos });
});

app.delete('/carrito/:id', authMiddleware, (req, res) => {
    let carritos = leerArchivo('carritos.json');
    let carrito = carritos.find(c => c.username === req.user.username);

    if (!carrito) return res.status(404).json({ error: 'Carrito no encontrado' });

    carrito.productos = carrito.productos.filter(p => p.id != req.params.id);
    escribirArchivo('carritos.json', carritos);

    res.json({ mensaje: 'Producto eliminado del carrito' });
});

app.put('/carrito/:id', authMiddleware, (req, res) => {
    const { cantidad } = req.body;
    let carritos = leerArchivo('carritos.json');
    let carrito = carritos.find(c => c.username === req.user.username);

    if (!carrito) return res.status(404).json({ error: 'Carrito no encontrado' });

    let producto = carrito.productos.find(p => p.id == req.params.id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado en el carrito' });

    producto.cantidad = cantidad;
    escribirArchivo('carritos.json', carritos);

    res.json({ mensaje: 'Producto modificado', producto });
});

// **Iniciar servidor**
app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
