const express = require('express');
const router = express.Router();
const mariadb = require('mariadb');

const { param, body, validationResult } = require('express-validator');

myValidationResult = validationResult.withDefaults({
    formatter: error => {
        return {
            msg: error.msg,
            value: error.value,
            param: error.param
        };
    },
});

const createConnection = async (opts) => await mariadb.createConnection(opts);
const connect = async () => await createConnection({host: '127.0.0.1', user: 'root', password: 'root', database: 'sample'});
const handleError = (res, message) => res.status(500).json({errors: [{msg: message, value: null, param: null}]});

/**
 * @swagger
 * /customers:
 *   get:
 *     summary: Returns a list of customers.
 *     tags: [Customers]
 *     parameters:
 *     responses:
 *       200:
 *         description: A list of customers.
 *       500:
 *         description: When a server error occurs.
 */
router.get('/customers', async function (req, res) {
    try {
        const conn = await connect();
        conn.query('SELECT * FROM customer').then(results => {
            res.json(results);
        })
        .catch(e => {
            handleError(res, e.message);
        });
    } catch (e) {
        handleError(res, e.message);
    }
});

/**
 * @swagger
 * /customers/{id}:
 *   get:
 *     summary: Return a single customer.
 *     tags: [Customers]
 *     parameters:
 *       - in: path
 *         name: id
 *         description: customer code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The customer information.
 *       400:
 *         description: One or more parameters are invalid.
 *       500:
 *         description: When a server error occurs.
 */
router.get(
    '/customers/:id', 
    param('id').isLength({min: 6, max: 6}),
    async function (req, res) {
        const errors = myValidationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const conn = await connect();
            conn.query('SELECT * FROM customer WHERE cust_code = ?', [req.params.id]).then(results => {
                res.json(results);
            })
            .catch(e => {
                handleError(res, e.message);
            });
        } catch (e) {
            handleError(res, e.message);
        }
    }
);

/**
 * @swagger
 * /customers/{id}/orders:
 *   get:
 *     summary: Return all orders for a customer.
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         description: customer code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The list of orders for the customer.
 *       400:
 *         description: One or more parameters are invalid.
 *       500:
 *         description: When a server error occurs.
 */
router.get(
    '/customers/:id/orders',
    param('id').isLength({min: 6, max: 6}),
    async function (req, res) {
        const errors = myValidationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const conn = await connect();
            conn.query('SELECT * FROM orders WHERE cust_code = ?', [req.params.id]).then(results => {
                res.json(results);
            })
            .catch(e => {
                handleError(res, e.message);
            });
        } catch (e) {
            handleError(res, e.message);
        }
    }
);

/**
 * @swagger
 * /customers/{id}/orders:
 *   post:
 *     summary: Create a new order for a customer.
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         description: customer code
 *         required: true
 *         schema:
 *           type: string
 *       - in: body
 *         name: ord_num
 *         description: The order number.
 *         required: true
 *         schema:
 *           type: string
 *       - in: body
 *         name: ord_amount
 *         description: The amount of the order.
 *         required: true
 *         schema:
 *           type: string
 *       - in: body
 *         name: advance_amount
 *         description: The amount of the order, in advance.
 *         required: true
 *         schema:
 *           type: string
 *       - in: body
 *         name: ord_date
 *         description: The ISO-8601-formatted date of the order.
 *         required: true
 *         schema:
 *           type: string
 *       - in: body
 *         name: agent_code
 *         description: The agent's code of the order.
 *         required: true
 *         schema:
 *           type: string
 *       - in: body
 *         name: ord_description
 *         description: A brief description of the order.
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       303:
 *         description: Redirect to the new order.
 *       400:
 *         description: One or more parameters are invalid.
 *       404:
 *         description: If the customer does not exist.
 *       500:
 *         description: When a server error occurs.
 */
router.post(
    '/customers/:id/orders',
    param('id').isLength({min: 6, max: 6}),
    body('ord_num').isLength({min: 6, max: 6}).isNumeric({no_symbols: true}),
    body('ord_amount').isCurrency({symbol: '', require_decimal: true, allow_negatives: false}),
    body('advance_amount').isCurrency({symbol: '', require_decimal: true, allow_negatives: false}),
    body('ord_date').isISO8601({strict: true}),
    body('agent_code').isLength({min: 4, max: 4}).trim(),
    body('ord_description').isLength({min: 1, max: 60}).trim(),
    async function(req, res) {
        const errors = myValidationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const reqBody = Object.values(req.body);
            reqBody.push(req.params.id);

            const conn = await connect();

            // Make sure the customer exists
            let results = await conn.query('SELECT COUNT(*) AS `exists` FROM customer WHERE cust_code = ?', [req.params.id]);
            
            if (results[0].exists === 0) {
                return res.status(404).json();
            }

            // Do not enter the order more than once
            results = await conn.query('SELECT COUNT(*) AS `exists` FROM orders WHERE ord_num = ?', [req.body.ord_num]);

            if (results[0].exists === 1) {
                return res.redirect(303, `/customers/${req.params.id}/orders/${req.body.ord_num}`);
            }

            conn.query(`
                INSERT INTO orders (ord_num, ord_amount, advance_amount, ord_date, agent_code, ord_description, cust_code)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, reqBody).then(() => res.redirect(303, `/customers/${req.params.id}/orders/${req.body.ord_num}`));
        } catch (e) {
            handleError(res, e.message);
        }
    }
);

/**
 * @swagger
 * /customers/{id}/orders/{order_num}:
 *   get:
 *     summary: Return an order for a customer.
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         description: customer code
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: order_num
 *         description: order number
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The order information for the customer.
 *       400:
 *         description: One or more parameters are invalid.
 *       500:
 *         description: When a server error occurs.
 */
router.get(
    '/customers/:id/orders/:order_num',
    param('id').isLength({min: 6, max: 6}),
    param('order_num').isNumeric(),
    async function (req, res) {
        const errors = myValidationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const conn = await connect();
            conn.query(
                'SELECT * FROM orders WHERE cust_code = ? AND ord_num = ?',
                [req.params.id, req.params.order_num]
            ).then(results => {
                res.json(results);
            })
            .catch(e => {
                handleError(res, e.message);
            });
        } catch (e) {
            handleError(res, e.message);
        }
    }
);

/**
 * @swagger
 * /customers/{id}/orders/{order_num}:
 *   put:
 *     summary: Update an order for a customer.
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         description: customer code
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: order_num
 *         description: order number
 *         required: true
 *         schema:
 *           type: string
 *       - in: body
 *         name: ord_num
 *         description: The order number.
 *         required: true
 *         schema:
 *           type: string
 *       - in: body
 *         name: ord_amount
 *         description: The amount of the order.
 *         required: true
 *         schema:
 *           type: string
 *       - in: body
 *         name: advance_amount
 *         description: The amount of the order, in advance.
 *         required: true
 *         schema:
 *           type: string
 *       - in: body
 *         name: ord_date
 *         description: The ISO-8601-formatted date of the order.
 *         required: true
 *         schema:
 *           type: string
 *       - in: body
 *         name: agent_code
 *         description: The agent's code of the order.
 *         required: true
 *         schema:
 *           type: string
 *       - in: body
 *         name: ord_description
 *         description: A brief description of the order.
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: When the order for the customer is updated.
 *       400:
 *         description: One or more parameters are invalid.
 *       404:
 *         description: When either the customer or the order does not exist.
 *       500:
 *         description: When a server error occurs.
 */
router.put(
    '/customers/:id/orders/:order_num',
    param('id').isLength({min: 6, max: 6}),
    param('order_num').isNumeric(),
    body('ord_num').isLength({min: 6, max: 6}).isNumeric({no_symbols: true}),
    body('ord_amount').isCurrency({symbol: '', require_decimal: true, allow_negatives: false}),
    body('advance_amount').isCurrency({symbol: '', require_decimal: true, allow_negatives: false}),
    body('ord_date').isISO8601({strict: true}),
    body('agent_code').isLength({min: 4, max: 4}).trim(),
    body('ord_description').isLength({min: 1, max: 60}).trim(),
    async function (req, res) {
        const errors = myValidationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const conn = await connect();

            // Verify if the order exists
            let results = await conn.query(
                'SELECT COUNT(*) AS `exists` FROM orders WHERE cust_code = ? AND ord_num = ?',
                [req.params.id, req.params.order_num]
            );

            if (results[0].exists === 0) {
                return res.status(404).json();
            }

            await conn.query(
                `UPDATE orders SET ord_num = ?, ord_amount = ?, advance_amount = ?, ord_date = ?, agent_code = ?, ord_description = ?
                WHERE cust_code = ? AND ord_num = ?`,
                [
                     req.body.ord_num,
                     req.body.ord_amount,
                     req.body.advance_amount,
                     req.body.ord_date,
                     req.body.agent_code,
                     req.body.ord_description,
                     req.params.id,
                     req.params.order_num,
                ]
             );

            return res.status(204).json();
        } catch (e) {
            handleError(res, e.message);
        }
    }
);

/**
 * @swagger
 * /customers/{id}/orders/{order_num}:
 *   patch:
 *     summary: Partially update an order for a customer.
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         description: customer code
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: order_num
 *         description: order number
 *         required: true
 *         schema:
 *           type: string
 *       - in: body
 *         name: ord_num
 *         description: The order number.
 *         required: false
 *         schema:
 *           type: string
 *       - in: body
 *         name: ord_amount
 *         description: The amount of the order.
 *         required: false
 *         schema:
 *           type: string
 *       - in: body
 *         name: advance_amount
 *         description: The amount of the order, in advance.
 *         required: false
 *         schema:
 *           type: string
 *       - in: body
 *         name: ord_date
 *         description: The ISO-8601-formatted date of the order.
 *         required: false
 *         schema:
 *           type: string
 *       - in: body
 *         name: agent_code
 *         description: The agent's code of the order.
 *         required: false
 *         schema:
 *           type: string
 *       - in: body
 *         name: ord_description
 *         description: A brief description of the order.
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: The order for the customer was patched.
 *       400:
 *         description: One or more parameters are invalid.
 *       404:
 *         description: When either the customer or the order does not exist.
 *       500:
 *         description: When a server error occurs.
 */
router.patch(
    '/customers/:id/orders/:order_num',
    param('id').isLength({min: 6, max: 6}),
    param('order_num').isNumeric(),
    body('ord_num').optional().isLength({min: 6, max: 6}).isNumeric({no_symbols: true}),
    body('ord_amount').optional().isCurrency({symbol: '', require_decimal: true, allow_negatives: false}),
    body('advance_amount').optional().isCurrency({symbol: '', require_decimal: true, allow_negatives: false}),
    body('ord_date').optional().isISO8601({strict: true}),
    body('agent_code').optional().isLength({min: 4, max: 4}).trim(),
    body('ord_description').optional().isLength({min: 1, max: 60}).trim(),
    async function (req, res) {
        const errors = myValidationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const conn = await connect();

            // Verify if the order exists
            let results = await conn.query(
                'SELECT COUNT(*) AS `exists` FROM orders WHERE cust_code = ? AND ord_num = ?',
                [req.params.id, req.params.order_num]
            );

            if (results[0].exists === 0) {
                return res.status(404).json();
            }

            const parts = [];
            const data = [];

            for (const key of Object.keys(req.body)) {
                const value = req.body[key];
                parts.push(key);
                data.push(value);
            }

            data.push(req.params.id);
            data.push(req.params.order_num);

            await conn.query(
                `UPDATE orders SET ${parts.join(' = ?, ')} = ?
                WHERE cust_code = ? AND ord_num = ?`,
                data
             );

            return res.status(204).json();
        } catch (e) {
            handleError(res, e.message);
        }
    }
);

/**
 * @swagger
 * /customers/{id}/orders/{order_num}:
 *   delete:
 *     summary: Deletes an order for a customer.
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         description: customer code
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: order_num
 *         description: order number
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: The order for the customer was deleted.
 *       400:
 *         description: One or more parameters are invalid.
 *       404:
 *         description: The order does not exist for the customer.
 *       500:
 *         description: When a server error occurs.
 */
router.delete(
    '/customers/:id/orders/:order_num',
    param('id').isLength({min: 6, max: 6}),
    param('order_num').isNumeric(),
    async function (req, res) {
        const errors = myValidationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const conn = await connect();

            // Verify if the order exists
            let results = await conn.query(
                'SELECT COUNT(*) AS `exists` FROM orders WHERE cust_code = ? AND ord_num = ?',
                [req.params.id, req.params.order_num]
            );

            if (results[0].exists === 0) {
                return res.status(404).json();
            }

            await conn.query(
                'DELETE FROM orders WHERE cust_code = ? AND ord_num = ?',
                [req.params.id, req.params.order_num]
            );

            return res.status(204).json();
        } catch (e) {
            handleError(res, e.message);
        }
    }
);

module.exports = router;
