const http = require('http');

const post = (path, data) => {
    const dataString = JSON.stringify(data);
    const options = {
        hostname: 'localhost',
        port: 8080,
        path: '/api' + path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': dataString.length
        }
    };

    const req = http.request(options, (res) => {
        console.log(`STATUS: ${res.statusCode}`);
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
            console.log(`BODY: ${chunk}`);
        });
    });

    req.on('error', (e) => {
        console.error(`problem with request: ${e.message}`);
    });

    req.write(dataString);
    req.end();
};

// Create Activity for Realtime Test
setTimeout(() => {
    console.log('Sending realtime activity...');
    post('/activities', {
        title: "Prueba Tiempo Real",
        date: new Date().toISOString().split('T')[0],
        time: "12:00",
        type: "activity"
    });
}, 15000); // Wait 15s to allow browser to load
