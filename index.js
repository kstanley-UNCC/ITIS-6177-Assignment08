const express = require('express');
const cors = require('cors');

const routes = require('./routes');

const swaggerUI = require('swagger-ui-express');
const swaggerDoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "ITIS-6177 Week 06: REST + Swagger Exercise",
            version: "1.0.0",
            description: "A REST-like API",
            contact: {
                name: "Ken Stanley",
                email: "kstanl27@uncc.edu",
            },
        },
    },
    apis: ["./routes.js"],
};

const specs = swaggerDoc(options);

const app = express();
app.use(cors());
app.use(express.json());

app.use('/', routes);
app.use('/docs', swaggerUI.serve, swaggerUI.setup(specs));

// Catch-all for non-existent routes
app.get('*', function (req, res) {
    res.statusCode = 404;
    res.send();
});

app.listen(3000, function () {
    const host = this.address().address;
    const port = this.address().port;

    console.log("Example app listening at http://%s:%s", host, port);
});
