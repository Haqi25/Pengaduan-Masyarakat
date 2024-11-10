const bcrypt = require('bcrypt');

// Ganti dengan password yang ingin di-hash
const password = 'admin123'; // Ganti dengan password yang diinginkan
const saltRounds = 10; // Jumlah putaran salt

bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) {
        console.error('Error hashing password:', err);
    } else {
        console.log('Hashed Password:', hash);
    }
});
