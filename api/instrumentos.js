
const { neon } = require('@neondatabase/serverless');

function parseId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

module.exports = async function handler(req, res) {
    try {
        if (!process.env.DATABASE_URL) {
            return res.status(503).json({
                error: 'Falta configurar DATABASE_URL en las variables de entorno de Vercel.'
            });
        }

        const sql = neon(process.env.DATABASE_URL);

        if (req.method === 'GET') {
            const instrumentos = await sql`
                SELECT *
                FROM instrumentos
                ORDER BY id DESC
            `;

            return res.status(200).json(instrumentos);
        }

        if (req.method === 'POST') {
            const {
                usuario,
                nombre_instrumento,
                numero_parte,
                numero_serie,
                foto_url
            } = req.body || {};

            if (
                !usuario ||
                !nombre_instrumento ||
                !numero_parte ||
                !numero_serie
            ) {
                return res.status(400).json({
                    error: 'Completá el usuario, instrumento, número de parte y número de serie.'
                });
            }

            const resultado = await sql`
                INSERT INTO instrumentos (
                    usuario,
                    nombre_instrumento,
                    numero_parte,
                    numero_serie,
                    foto_url
                )
                VALUES (
                    ${usuario},
                    ${nombre_instrumento},
                    ${numero_parte},
                    ${numero_serie},
                    ${foto_url || null}
                )
                RETURNING *
            `;

            return res.status(201).json(resultado[0]);
        }

        if (req.method === 'PUT') {
            const id = parseId(req.query?.id);
            if (!id) {
                return res.status(400).json({ error: 'El id del instrumento no es válido.' });
            }

            const {
                usuario,
                nombre_instrumento,
                numero_parte,
                numero_serie,
                foto_url
            } = req.body || {};

            if (
                !usuario ||
                !nombre_instrumento ||
                !numero_parte ||
                !numero_serie
            ) {
                return res.status(400).json({
                    error: 'Completá el usuario, instrumento, número de parte y número de serie.'
                });
            }

            const resultado = await sql`
                UPDATE instrumentos
                SET usuario = ${usuario},
                    nombre_instrumento = ${nombre_instrumento},
                    numero_parte = ${numero_parte},
                    numero_serie = ${numero_serie},
                    foto_url = ${foto_url || null}
                WHERE id = ${id}
                RETURNING *
            `;

            if (resultado.length === 0) {
                return res.status(404).json({ error: 'No se encontró el instrumento.' });
            }

            return res.status(200).json(resultado[0]);
        }

        if (req.method === 'DELETE') {
            const id = parseId(req.query?.id);
            if (!id) {
                return res.status(400).json({ error: 'El id del instrumento no es válido.' });
            }

            const resultado = await sql`
                DELETE FROM instrumentos
                WHERE id = ${id}
                RETURNING id
            `;

            if (resultado.length === 0) {
                return res.status(404).json({ error: 'No se encontró el instrumento.' });
            }

            return res.status(200).json({ id: resultado[0].id });
        }

        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({
            error: 'Método no permitido.'
        });

    } catch (error) {
        console.error('Error en API de instrumentos:', error);

        return res.status(500).json({
            error: 'No se pudieron procesar los instrumentos.'
        });
    }
};