import express from 'express';
import cors from "cors";
import joi from 'joi';
import dayjs from 'dayjs';
import { connection } from './database.js';

const server = express();
server.use(cors());
server.use(express.json());

/* categories */

server.get('/categories', async (req, res) => {

    try {

        const categories = await connection.query('SELECT * FROM categories;');
        
        res.send(categories.rows);

    } catch (error) {
        console.log(error.message);
        res.sendStatus(500);
    }
});

server.post('/categories', async (req, res) => {

    const { name } = req.body;

    const userSchema = joi.object ({
        name: joi.string().required().empty(' ')
    });

    const validation = userSchema.validate(req.body);

    if (validation.error) {
        return res.status(400).send(validation.error.details[0].message);
    }

    try {

        const isName = await connection.query(
            'SELECT name FROM categories WHERE name = $1;',
            [name]
        );

        if ( isName.rows.length !== 0) {
            return res.sendStatus(409);
        }

        await connection.query(
            'INSERT INTO categories (name) VALUES ($1);',
            [name]
        );

        res.sendStatus(201);
        
    } catch (error) {
        console.log(error.message);
        res.sendStatus(500);
    }

});

/* games */

server.get('/games', async (req, res) => {

    const { name } = req.query;

    if (name) {
        const games = await connection.query(
            `SELECT games.*,  categories.name AS "categoryName" FROM games JOIN categories ON games."categoryId"=categories.id WHERE games."name" ILIKE '${name}%';`
        );
        return res.send(games.rows);
    }

    const games = await connection.query(
        'SELECT games.*,  categories.name AS "categoryName" FROM games JOIN categories ON games."categoryId"=categories.id;'
    );

    res.send(games.rows);
});

server.post('/games', async (req, res) => {

    const { name, image,  stockTotal, categoryId, pricePerDay } = req.body;

    const userSchema = joi.object ({
        name: joi.string().empty(' ').required(),
        image: joi.string().required(),
        stockTotal: joi.number().integer().min(0).required(),
        categoryId: joi.number().integer().min(1).required(),
        pricePerDay: joi.number().min(0).required(),
    });

    const validation = userSchema.validate(req.body, { abortEarly: false });

    if (validation.error) {
        const errors = validation.error.details.map((detail => detail.message));
        return res.status(422).send(errors);
    }

    try {

        const isName = await connection.query(
            'SELECT name FROM games WHERE name = $1;',
            [name]
        );

        if ( isName.rows.length !== 0) {
            return res.sendStatus(409);
        }

        const isCategoryId = await connection.query(
            'SELECT id FROM categories WHERE id = $1',
            [categoryId]
        );

        if ( isCategoryId.rows.length === 0) {
            return res.sendStatus(400);
        }
        
        await connection.query(
            'INSERT INTO games ("name", "image",  "stockTotal", "categoryId", "pricePerDay") VALUES ($1, $2, $3, $4, $5);', 
            [name, image,  stockTotal, categoryId, pricePerDay]
        );   

        res.sendStatus(201);

    } catch (error) {
        console.log(error.message);
        res.sendStatus(500);
    }
});

/* customers */

server.get('/customers', async (req, res) => {

    const { cpf } = req.query;

    if (cpf) {
        const customers = await connection.query(
            `SELECT * from customers WHERE cpf ILIKE '${cpf}%';`
        );

        return res.send(customers.rows);
    }

    const customers = await connection.query('SELECT * from customers;');

    res.send(customers.rows);
});

server.get('/customers/:id', async (req, res) => {

    const { id } = req.params;

    const customer = await connection.query(
        'SELECT * from customers WHERE id = $1;', 
        [id]
    );

    if (customer.rows.length === 0) {
        res.sendStatus(404);
    }

    res.send(customer.rows[0]);
});

server.post('/customers', async (req, res) => {

    const { name, phone, cpf, birthday} = req.body;

    const userSchema = joi.object ({
        name: joi.string().empty(' ').required(),
        phone: joi.string().length(10).length(11).pattern(/^[0-9]+$/).required(),
        cpf: joi.string().length(11).pattern(/^[0-9]+$/).required(),
        birthday: joi.date().iso().required()
    });

    const validation = userSchema.validate(req.body, { abortEarly: false });

    if (validation.error) {
        const errors = validation.error.details.map((detail => detail.message));
        return res.status(400).send(errors);
    }

    try {

        const isCpf = await connection.query(
            'SELECT cpf FROM customers WHERE cpf = $1', 
            [cpf]
        );

        if (isCpf.rows.length !== 0) {
            return res.sendStatus(409);
        }

        await connection.query(
            'INSERT INTO customers ("name", "phone", "cpf", "birthday") VALUES ($1, $2, $3, $4);', 
            [name, phone, cpf, birthday]
        );
    
        res.sendStatus(201);

    } catch (error) {
        console.log(error.message);
        res.sendStatus(500);
    }
});

server.put('/customers/:id' , async (req, res) => {

    const { id } = req.params;
    const { name, phone, cpf, birthday} = req.body;

    const userSchema = joi.object ({
        name: joi.string().empty(' '),
        phone: joi.string().length(10).length(11).pattern(/^[0-9]+$/),
        cpf: joi.string().length(11).pattern(/^[0-9]+$/),
        birthday: joi.date().iso()
    });

    const validation = userSchema.validate(req.body, { abortEarly: false });

    if (validation.error) {
        const errors = validation.error.details.map((detail => detail.message));
        return res.status(400).send(errors);
    }

    try {

        const customerCpf = await connection.query(
            'SELECT cpf FROM customers WHERE id = $1',
            [id]
        );

        const isCpf = await connection.query(
            'SELECT cpf FROM customers WHERE cpf = $1', 
            [cpf]
        );

        if (isCpf.rows.length !== 0) {

            if ( cpf === customerCpf.rows[0].cpf) {
                await connection.query(
                    `
                        UPDATE customers 
                        SET name = $1, phone = $2, cpf = $3, birthday = $4 
                        WHERE id = $5;
                    `, 
                    [name, phone, cpf, birthday, id]
                );
                return res.sendStatus(200);
            }
    
            return res.sendStatus(409);
        }

        await connection.query(
            `
                UPDATE customers 
                SET name = $1, phone = $2, cpf = $3, birthday = $4 
                WHERE id = $5;
            `, 
            [name, phone, cpf, birthday, id]
        );
    
        res.sendStatus(200);

    } catch (error) {
        console.log(error.message);
        res.sendStatus(500);
    }
});

/* rentals */

server.get('/rentals', async (req, res) => {

    const { customerId } = req.query;
    const { gameId } = req.query;
    let rentals;

    try {

        if (customerId) {

            rentals = await connection.query(
                `
                    SELECT
                        rentals.*,
                        JSON_BUILD_OBJECT (
                            'id',  customers.id,
                            'name', customers.name
                        )
                        AS customer,
                        JSON_BUILD_OBJECT (
                        'id',  games.id,
                            'name', games.name,
                            'categoryId', games."categoryId",
                            'categoryName', categories.name
                        )               
                        AS game
                    FROM rentals 
                        JOIN customers
                        ON rentals."customerId" = customers."id"
                        JOIN games
                        ON rentals."gameId" = games."id"
                        JOIN categories
                        ON games."categoryId" = categories."id"
                    WHERE customers."id" = $1;
                `,
                [customerId]
            );

        }

        else if (gameId) {

            rentals = await connection.query(
                `
                    SELECT
                        rentals.*,
                        JSON_BUILD_OBJECT (
                            'id',  customers.id,
                            'name', customers.name
                        )
                        AS customer,
                        JSON_BUILD_OBJECT (
                        'id',  games.id,
                            'name', games.name,
                            'categoryId', games."categoryId",
                            'categoryName', categories.name
                        )               
                        AS game
                    FROM rentals 
                        JOIN customers
                        ON rentals."customerId" = customers."id"
                        JOIN games
                        ON rentals."gameId" = games."id"
                        JOIN categories
                        ON games."categoryId" = categories."id"
                    WHERE games."id" = $1;
                `,
                [gameId]
            );

        } 

        else {
            rentals = await connection.query(
                `
                    SELECT
                        rentals.*,
                        JSON_BUILD_OBJECT (
                            'id',  customers.id,
                            'name', customers.name
                        )
                        AS customer,
                        JSON_BUILD_OBJECT (
                           'id',  games.id,
                            'name', games.name,
                            'categoryId', games."categoryId",
                            'categoryName', categories.name
                        )               
                        AS game
                    FROM rentals 
                        JOIN customers
                        ON rentals."customerId" = customers."id"
                        JOIN games
                        ON rentals."gameId" = games."id"
                        JOIN categories
                        ON games."categoryId" = categories."id";
                `
            );
        }  
        
        res.send(rentals.rows);

    } catch (error) {
        console.log(error.message);
        res.sendStatus(500);
    }

});

server.post('/rentals', async (req, res) => {

   const { customerId, gameId, daysRented } = req.body;
   const rentDate = dayjs().format('YYYY-MM-DD');

   const userSchema = joi.object ({
        daysRented: joi.number().min(1).required(),
        customerId: joi.number().required(),
        gameId: joi.number().required(),
    });

    const validation = userSchema.validate(req.body);

    if (validation.error) {
        return res.status(400).send(validation.error.details[0].message);
    }

   try {
        
        const customer = await connection.query(
            'SELECT id FROM customers WHERE id = $1;',
            [gameId]
        );

        const game = await connection.query(
            'SELECT * FROM games WHERE id = $1;', 
            [gameId]
        );

        if (
            game.rows.length === 0 || 
            game.rows[0].stockTotal < 1 || 
            customer.rows.length === 0
        ) {
            return res.sendStatus(400);
        }
        
        const originalPrice = daysRented*(game.rows[0].pricePerDay);
        const stockTotal = game.rows[0].stockTotal -1;

        await connection.query(
            'INSERT INTO rentals ("customerId", "gameId", "rentDate", "daysRented", "returnDate", "originalPrice", "delayFee") VALUES ($1, $2, $3, $4, null, $5, null);', 
            [customerId, gameId, rentDate, daysRented, originalPrice]
        );

        await connection.query(
            'UPDATE games SET "stockTotal" = $1 WHERE id = $2',
            [stockTotal, gameId]
        );

        res.sendStatus(201);

   } catch (error) {
        console.log(error.message);
        res.sendStatus(500);
   }

});

server.post('/rentals/:id/return', async (req, res) => {

    const { id } = req.params;
    const returnDate = dayjs().format('YYYY-MM-DD');

    try {
        
        const rental = await connection.query(
            'SELECT * FROM rentals WHERE id = $1;',
            [id]
        );

        const game = await connection.query(
            'SELECT * FROM games WHERE id = $1;', 
            [rental.rows[0].gameId]
        );

        if(rental.rows.length === 0) {
            return res.sendStatus(404);
        }

        if (rental.rows[0].returnDate !== null) {
            return res.sendStatus(400);
        }

        const rentDate = rental.rows[0].rentDate;
        const daysRented = rental.rows[0].daysRented;
        const originalPrice = rental.rows[0].originalPrice;
        const diffInMs   = new Date(returnDate) - new Date(rentDate);
        const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
        const delayFee = originalPrice*(diffInDays - daysRented);
        const stockTotal = game.rows[0].stockTotal +1;

        if (delayFee > 0) {
            await connection.query(
                `UPDATE rentals SET "delayFee" = ${delayFee} WHERE id = $1`,
                [id]
            )
        }

        await connection.query(
            `UPDATE rentals SET "returnDate" = $1 WHERE id = $2`,
            [returnDate, id]
        );

        await connection.query(
            'UPDATE games SET "stockTotal" = $1 WHERE id = $2',
            [stockTotal, rental.rows[0].gameId]
        );

        res.sendStatus(200);

    } catch (error) {
        console.log(error.message);
        res.sendStatus(500);
    }
});

server.delete('/rentals/:id', async (req, res) => {

    const { id } = req.params;

    try {

        const rental = await connection.query(
            'SELECT * FROM rentals WHERE id = $1;',
            [id]
        );

        if (rental.rows.length === 0) {
            return res.sendStatus(404);
        }

        if (rental.rows[0].returnDate === null) {
            return res.sendStatus(400);
        }

        await connection.query(
            'DELETE FROM rentals WHERE id = $1;',
            [id]
        );
        
        res.sendStatus(200);

    } catch (error) {
        console.log(error.message);
        res.sendStatus(500);
    }
});

server.listen(4000, () => {
    console.log('Listening on port 4000');
});

