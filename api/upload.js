const { handleUpload } = require('@vercel/blob/client');

const allowedContentTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maximumSizeInBytes = 4 * 1024 * 1024;

function isSameOriginRequest(req) {
    const origin = req.headers.origin;
    const requestHost = String(req.headers['x-forwarded-host'] || req.headers.host || '')
        .split(',')[0]
        .trim()
        .toLowerCase();
    const requestProtocol = String(req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http'))
        .split(',')[0]
        .trim()
        .toLowerCase();

    if (typeof origin !== 'string' || !requestHost) {
        return false;
    }

    try {
        const originUrl = new URL(origin);
        return originUrl.host.toLowerCase() === requestHost
            && originUrl.protocol === `${requestProtocol}:`;
    } catch {
        return false;
    }
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: 'Método no permitido.' });
    }

    if (!isSameOriginRequest(req)) {
        return res.status(403).json({ error: 'La solicitud de subida no pertenece a este sitio.' });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return res.status(503).json({
            error: 'Falta BLOB_READ_WRITE_TOKEN. Vinculá el almacenamiento Images al proyecto en Vercel y redeplegá.'
        });
    }

    try {
        const jsonResponse = await handleUpload({
            body: req.body,
            request: req,
            onBeforeGenerateToken: async () => ({
                allowedContentTypes,
                maximumSizeInBytes,
                addRandomSuffix: true
            }),
            onUploadCompleted: async () => {}
        });

        return res.status(200).json(jsonResponse);
    } catch (error) {
        console.error('Error en API de subida:', error);
        return res.status(400).json({
            error: error instanceof Error
                ? error.message
                : 'No se pudo procesar la subida de la foto.'
        });
    }
};