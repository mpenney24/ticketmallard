import buildApp from './app';

const start = async () => {
    const server = await buildApp();
    try {
        await server.listen({ port: 3000, host: '0.0.0.0' });
        console.log('🦆 Ticketmallard backend roaring on http://localhost:3000');
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();
