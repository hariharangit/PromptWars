const request = require('supertest');
const app = require('../server');

describe('SOC Dashboard Backend API', () => {
    
    describe('GET /api/tasks', () => {
        it('should return a 200 status code and an array of tasks', async () => {
            const res = await request(app).get('/api/tasks');
            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('tasks');
            expect(Array.isArray(res.body.tasks)).toBe(true);
        });
    });

    describe('POST /api/chat', () => {
        it('should return a 400 error if message is missing', async () => {
            const res = await request(app)
                .post('/api/chat')
                .send({});
            
            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('error');
        });

        it('should return a 200 status and an AI reply when a valid message is sent', async () => {
            const res = await request(app)
                .post('/api/chat')
                .send({ message: 'What is the current threat level?' });
            
            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('reply');
            expect(typeof res.body.reply).toBe('string');
        });
    });
});
