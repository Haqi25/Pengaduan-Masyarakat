const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const multer = require('multer');
const moment = require('moment');



const app = express();
const PORT = 3001;

// Koneksi ke MySQL
const db = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'pengaduan_masyarakat2'
});

db.connect(err => {
    if (err) throw err;
    console.log('Connected to MySQL Database');
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'your-secret-key',
    resave: true,
    saveUninitialized: true,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Middleware untuk mengecek autentikasi
const checkAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    next();
};

// Middleware untuk mengecek level admin
const checkAdmin = (req, res, next) => {
    if (!req.session.userId || req.session.userLevel !== 'admin') {
        return res.redirect('/login');
    }
    next();
};

// Middleware untuk mengecek level pegawai
const checkPegawai = (req, res, next) => {
    if (!req.session.userId || req.session.userLevel !== 'pegawai') {
        return res.redirect('/login');
    }
    next();
};

app.use('/image', express.static(path.join(__dirname, 'image')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


// Rute pegawai dengan proteksi
app.get('/pegawai', checkPegawai, (req, res) => {
    const currentPage = parseInt(req.query.page) || 1;
    const currentPageUser = parseInt(req.query.pageUser) || 1;
    const itemsPerPage = 10;

    const countLaporanQuery = 'SELECT COUNT(*) AS total FROM data_laporan';
    db.query(countLaporanQuery, (err, countResults) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Terjadi kesalahan server saat menghitung total laporan');
        }
        const totalLaporan = countResults[0].total;
        const totalPagesLaporan = Math.ceil(totalLaporan / itemsPerPage);
        const offsetLaporan = (currentPage - 1) * itemsPerPage;

        const laporanQuery = `SELECT * FROM data_laporan LIMIT ?, ?`;
        db.query(laporanQuery, [offsetLaporan, itemsPerPage], (err, laporanResults) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Terjadi kesalahan server saat mengambil laporan');
            }

            // Format date for each laporan item
            laporanResults = laporanResults.map(item => {
                item.tanggal = moment(item.tanggal).format('DD MMMM YYYY');
                return item;
            });

            const countUserQuery = 'SELECT COUNT(*) AS total FROM user WHERE level = "user"';
            db.query(countUserQuery, (err, userCountResults) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).send('Terjadi kesalahan server saat menghitung total pengguna');
                }
                const totalUsers = userCountResults[0].total;
                const totalPagesUser = Math.ceil(totalUsers / itemsPerPage);
                const offsetUser = (currentPageUser - 1) * itemsPerPage;

                const userQuery = `SELECT * FROM user WHERE level = "user" LIMIT ?, ?`;
                db.query(userQuery, [offsetUser, itemsPerPage], (err, userResults) => {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).send('Terjadi kesalahan server saat mengambil data pengguna');
                    }

                    res.render('pegawai', {
                        laporan: laporanResults,
                        user: userResults,
                        currentPage,
                        totalPagesLaporan,
                        currentPageUser,
                        totalPagesUser
                    });
                });
            });
        });
    });
});

// Rute admin dengan proteksi
app.get('/admin', checkAdmin, (req, res) => {
    const page = parseInt(req.query.page) || 1; // Mendapatkan halaman dari query parameter, default ke 1
    const limit = 10; // Jumlah laporan per halaman
    const offset = (page - 1) * limit; // Menghitung offset

    const sql = 'SELECT COUNT(*) AS total FROM laporan_admin'; // Menghitung total laporan
    db.query(sql, (err, countResult) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Terjadi kesalahan server');
        }
        const total = countResult[0].total; // Total laporan
        const totalPages = Math.ceil(total / limit); // Menghitung total halaman

        // Mengambil laporan dengan limit dan offset
        const sqlPaginated = 'SELECT * FROM laporan_admin LIMIT ? OFFSET ?';
        db.query(sqlPaginated, [limit, offset], (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Terjadi kesalahan server');
            }
            res.render('admin', { laporan: results, currentPage: page, totalPages: totalPages });
        });
    });
});
// Rute persetujuan dengan proteksi
// Rute persetujuan dengan proteksi
// Rute persetujuan dengan proteksi
app.post('/setujui/:id', (req, res) => {
    const laporanId = req.params.id;
    const query = 'UPDATE laporan_admin SET status = "disetujui" WHERE id = ?';
    
    db.query(query, [laporanId], (error, results) => {
        if (error) {
            return res.status(500).send('Gagal mengubah status laporan');
        }
        res.redirect('/'); // Redirect kembali ke halaman utama setelah update
    });
});


// Rute untuk menandai laporan sebagai terlaksana
app.post('/terlaksana/:id', checkAdmin, (req, res) => {
    const laporanId = req.params.id;

    const updateStatusSql = 'UPDATE laporan_admin SET status = "terlaksana" WHERE id = ?';
    db.query(updateStatusSql, [laporanId], (err) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Terjadi kesalahan saat memperbarui status.');
        }
        res.redirect('/admin');
    });
});

// Rute index
app.get('/', (req, res) => {
    res.render('index');
});
app.get('/sambat', (req, res) => {
    res.render('sambat');
});





// Rute untuk menyetujui laporan
app.post('/approve/:id', checkPegawai, (req, res) => {
    const laporanId = req.params.id;

    const selectSql = 'SELECT * FROM data_laporan WHERE id = ?';
    db.query(selectSql, [laporanId], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Terjadi kesalahan server');
        }

        if (results.length > 0) {
            const laporan = results[0];

            const insertSql = 'INSERT INTO laporan_admin (judul, isi, tanggal, tkp, kategori, gambar) VALUES (?, ?, ?, ?, ?, ?)';
            db.query(insertSql, [laporan.judul, laporan.isi, laporan.tanggal, laporan.tkp, laporan.kategori, laporan.gambar], (err, insertResult) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).send('Terjadi kesalahan saat menyimpan data.');
                }
                                                                                    
                const deleteSql = 'DELETE FROM data_laporan WHERE id = ?';
                db.query(deleteSql, [laporanId], (err, deleteResult) => {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).send('Terjadi kesalahan saat menghapus data.');
                    }
                    res.redirect('/pegawai');
                });
            });
        } else {
            res.send('Data laporan tidak ditemukan!');
        }
    });
});

// Rute untuk menolak laporan
app.post('/reject/:id', checkPegawai, (req, res) => {
    const laporanId = req.params.id;

    const deleteSql = 'DELETE FROM data_laporan WHERE id = ?';
    db.query(deleteSql, [laporanId], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Terjadi kesalahan saat menghapus data.');
        }

        res.redirect('/pegawai');
    });
});

// Rute form dengan proteksi
app.get('/form', checkAuth, (req, res) => {
    const message = req.session.message;
    req.session.message = null;
    const userId = req.session.userId;

    const sql = 'SELECT username FROM user WHERE id = ?';
    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.redirect('/login');
        }

        if (results.length > 0) {
            const user = results[0];
            res.render('form', { message, user });
        } else {
            req.session.destroy();
            res.redirect('/login');
        }
    });
});

// Rute login
app.get('/login', (req, res) => {
    if (req.session.userId) {
        const sql = 'SELECT level FROM user WHERE id = ?';
        db.query(sql, [req.session.userId], (err, results) => {
            if (err || results.length === 0) {
                req.session.destroy();
                return res.render('login', { message: null });
            }
            
            const userLevel = results[0].level;
            if (userLevel === 'admin') {
                res.redirect('/admin');
            } else if (userLevel === 'pegawai') {
                res.redirect('/pegawai');
            } else {
                res.redirect('/form');
            }
        });
    } else {
        res.render('login', { message: req.session.message || null });
    }
});

// Konfigurasi multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'image'));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb('Error: Tipe file tidak diizinkan!');
    }
});

// Rute untuk menambah data laporan
app.post('/add_data_laporan', checkAuth, upload.single('gambar'), async (req, res) => {
    const { judul, isi, tanggal, tkp, kategori } = req.body;
    const gambar = req.file ? req.file.filename : 'default.jpg';

    if (!judul || !isi || !tanggal || !tkp || !kategori) {
        return res.send('Semua field harus diisi.');
    }

    const sql = 'INSERT INTO data_laporan (judul, isi, tanggal, tkp, kategori, gambar) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(sql, [judul, isi, tanggal, tkp, kategori, gambar], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Terjadi kesalahan saat menyimpan data.');
        }

        req.session.message = 'Berhasil membuat laporan!';
        res.redirect('/form');
    });
});

// Proses login
app.post('/logincek', async (req, res) => {
    const { email, password } = req.body;

    try {
        const sql = 'SELECT * FROM user WHERE email = ?';
        db.query(sql, [email], async (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.render('login', { message: 'Terjadi kesalahan server' });
            }

            if (results.length === 0) {
                return res.render('login', { message: 'Email tidak ditemukan!' });
            }

            const user = results[0];
            const match = await bcrypt.compare(password, user.password);
            
            if (!match) {
                return res.render('login', { message: 'Password salah!' });
            }

            req.session.userId = user.id;
            req.session.userLevel = user.level;
            
            if (user.level === 'admin') {
                res.redirect('/admin');
            } else if (user.level === 'pegawai') {
                res.redirect('/pegawai');
            } else {
                res.redirect('/form');
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.render('login', { message: 'Terjadi kesalahan server' });
    }
});

// Rute untuk mengedit data laporan
app.get('/edit/:id', checkAdmin, (req, res) => {
    const laporanId = req.params.id;
    const sql = 'SELECT * FROM data_laporan WHERE id = ?';
    
    db.query(sql, [laporanId], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Terjadi kesalahan server');
        }

        if (results.length > 0) {
            res.render('edit_laporan', { laporan: results[0] });
        } else {
            res.send('Data laporan tidak ditemukan!');
        }
    });
});



// Rute untuk memperbarui data laporan
app.post('/update/:id', checkAdmin, (req, res) => {
    const laporanId = req.params.id;
    const { judul, isi, tanggal, tkp, kategori } = req.body;

    const sql = 'UPDATE data_laporan SET judul = ?, isi = ?, tanggal = ?, tkp = ?, kategori = ? WHERE id = ?';
    db.query(sql, [judul, isi, tanggal, tkp, kategori, laporanId], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Terjadi kesalahan saat memperbarui data.');
        }
x
        res.redirect('/admin');
    });
});

// Rute untuk menghapus data laporan
app.post('/delete/:id', checkAdmin, (req, res) => {
    const laporanId = req.params.id;
    console.log(`Attempting to delete report with ID: ${laporanId}`);

    const deletesql = 'DELETE FROM data_laporan WHERE id = ?';
    db.query(sql, [laporanId], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Terjadi kesalahan saat menghapus data.');
        }

        console.log(`Successfully deleted report with ID: ${laporanId}`);

        res.redirect('/admin');
    });
});



// Rute register
app.get('/register', (req, res) => {
    res.render('register', { name: '', email: '', username: '', alamat: '' });
});

//rute tampil laporan
app.get('/laporan', (req, res) => {
    const perPage = 10; // Jumlah laporan per halaman
    const page = parseInt(req.query.page) || 1; // Halaman saat ini, default ke 1

    // Menghitung offset
    const offset = (page - 1) * perPage;

    // Ambil kategori dan status dari query parameter
    const kategori = req.query.kategori || '';
    const status = req.query.status || '';

    // Membuat query untuk menghitung total laporan
    let countQuery = 'SELECT COUNT(*) AS total FROM laporan_admin WHERE 1=1';
    let countParams = [];

    // Menambahkan kondisi filter untuk kategori
    if (kategori) {
        countQuery += ' AND kategori = ?';
        countParams.push(kategori);
    }

    // Menambahkan kondisi filter untuk status
    if (status) {
        countQuery += ' AND status = ?';
        countParams.push(status);
    }

    // Ambil total laporan dari database
    db.query(countQuery, countParams, (err, result) => {
        if (err) {
            console.error('Error fetching total count:', err);
            return res.status(500).send('Terjadi kesalahan pada server');
        }

        const totalLaporan = result[0].total;
        console.log('Total Laporan:', totalLaporan); // Log total laporan
        const totalPages = Math.ceil(totalLaporan / perPage); // Menghitung total halaman
        console.log('Total Halaman:', totalPages); // Log total halaman

        // Ambil laporan untuk halaman saat ini
        let laporanQuery = 'SELECT * FROM laporan_admin WHERE 1=1';
        let laporanParams = [];

        // Menambahkan kondisi filter untuk kategori
        if (kategori) {
            laporanQuery += ' AND kategori = ?';
            laporanParams.push(kategori);
        }

        // Menambahkan kondisi filter untuk status
        if (status) {
            laporanQuery += ' AND status = ?';
            laporanParams.push(status);
        }

        // Menambahkan limit dan offset untuk pagination
        laporanQuery += ' LIMIT ?, ?';
        laporanParams.push(offset, perPage);

        db.query(laporanQuery, laporanParams, (err, laporan) => {
            if (err) {
                console.error('Error fetching reports:', err);
                return res.status(500).send('Terjadi kesalahan pada server');
            }

            // Log laporan yang diambil
            console.log('Laporan yang diambil:', laporan);

            // Render template dengan variabel yang diperlukan
            res.render('laporan', {
                laporan,
                page,
                totalPages,
                kategori,
                status
            });
        });
    });
});




// Proses registrasi
app.post('/registercheck', async (req, res) => {
    const { name, username, email, password, alamat, level } = req.body;

    const checkUserSql = 'SELECT * FROM user WHERE email = ?';
    db.query(checkUserSql, [email], async (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Terjadi kesalahan server');
        }

        if (results.length > 0) {
            return res.send('Email sudah terdaftar!');
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const sql = 'INSERT INTO user (name, username, email, alamat, password) VALUES (?, ?, ?, ?, ?)';
            db.query(sql, [name, username, email, alamat, hashedPassword, level], (err, result) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).send('Terjadi kesalahan saat menyimpan data.');
                }
                req.session.message = 'Data Berhasil Ditambahkan!';
                res.redirect('/login');
            });
        } catch (hashError) {
            console.error('Error hashing password:', hashError);
            res.status(500).send('Terjadi kesalahan saat menyimpan data.');
        }
    });
});

app.post('/delete-user/:id', (req, res) => {
    const userId = req.params.id;
    console.log('Permintaan untuk menghapus pengguna dengan ID:', userId);

    const deleteUserQuery = 'DELETE FROM user WHERE id = ?';
    db.query(deleteUserQuery, [userId], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Terjadi kesalahan server saat menghapus pengguna');
        }
        console.log('Pengguna berhasil dihapus');
        res.redirect('/pegawai');
    });
});

// Rute logout
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destruction error:', err);
        }
        res.redirect('/login');
    });
});

// Mulai server
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
