const { execSync } = require('child_process');
try {
    const res = execSync('npx ripgrep "Service\\.[a-zA-Z]+\\(" src/app/admin');
    console.log(res.toString());
} catch(e) {
    console.log(e.stdout ? e.stdout.toString() : e.message);
}
