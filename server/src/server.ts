import express from 'express';
import deviceRoutes from './routes/deviceRoutes'; // Import deviceRoutes
import path from 'path';

const app = express();
const port = 4000;

app.use(express.json());
app.use('/api/device', deviceRoutes); // Use deviceRoutes

const clientPath = process.env.CLIENT_PATH || '../../client/build';
app.use(express.static(path.join(__dirname, clientPath)));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, `${clientPath}/index.html`));
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

process.on('SIGINT', function() {
    console.log("Caught interrupt signal");
    process.exit();
});