const fastifyFactory = require('fastify')
const fastifyStatic = require('@fastify/static')

const _startHttpServer = async function (instance) {
    if (instance._http.started) {
        instance._log('debug', 'HTTP server already running')
        return
    }
    const fastify = fastifyFactory({ logger: false })

    // Static for Patch-UI (Fastify v5 + @fastify/static v8)
    fastify.register(fastifyStatic, {
        root: [require('path').join(__dirname, 'public'), __dirname],
        prefix: '/patch/',
    })

    // Root of the Patch-UI
    fastify.get('/', async (req, reply) => {
        return reply.redirect('patch', 301)
    })
    fastify.get('/patch', async (req, reply) => {
        return reply.sendFile('./public/patch.html')
    })
    fastify.get('/patch/', async (req, reply) => {
        return reply.sendFile('./public/patch.html')
    })

    fastify.get('/health', async (req, reply) => {
        return {
            status: 'ok',
            sequenceRunning: instance.sequenceRunning,
            activeSourceIndex: instance.activeSourceIndex,
        }
    })

    // New endpoint: Get current mappings from config
    fastify.get('/patch/mappings', async (req, reply) => {
        const maxRacks = parseInt(instance.config?.maxRacks, 10) || instance.rackCount || 64
        reply.code(200)
        return { success: true, mapping: instance.config.racks, meta: { maxRacks, numChannels: instance.channelCount, emptyMapping: instance.emptyMapping} }
    })

    fastify.get('/config/reset', async (req, reply) => {
        instance.saveConfig({})
        instance._applyConfigToLocalScopes()
        instance.updateActions()
        instance.updateFeedbacks()
        instance.updateVariableDefinitions()
    })

    // New endpoint: Apply mappings (connect)
    fastify.post('/patch/update', async (req, reply) => {
        try {
            const body = req.body || {}

            const mapping = body.mapping || []
            instance.config.racks = mapping
            instance.rackMap = mapping

            instance.saveConfig(instance.config)
            instance._applyConfigToLocalScopes()
            instance.updateActions()
            instance.updateFeedbacks()
            instance.updateVariableDefinitions()

            reply.code(200)
            return { status: 200, result: { updated: mapping.length-1, total: mapping.length-1 } }
        } catch (e) {
            instance._log('error', 'HTTP update failed', { error: e?.message })
            reply.code(500)
            return { status: 500, error: e?.message }
        }
    })

    fastify.patch('/rack/:id', async (req, reply) => {
        try {
            const { id } = req.params || {}
            const body = req.body || {}
            const rackId = parseInt(id, 10)
            if (isNaN(rackId)) {
                reply.code(400)
                return { status: 400, error: 'invalid rack id' }
            }

            const rackConfig = instance.config.racks?.[rackId] || { id: rackId, value: null }
            const newValue = body.value
            if (newValue == null || isNaN(parseInt(newValue, 10))) {
                reply.code(400)
                return { status: 400, error: 'invalid channel value' }
            }

            rackConfig.value = parseInt(newValue, 10)
            instance.config.racks[rackId] = rackConfig

            instance.saveConfig(instance.config)
            instance._applyConfigToLocalScopes()
            instance.updateActions()
            instance.updateFeedbacks()
            instance.updateVariableDefinitions()
            reply.code(200)
            return { status: 200, message: 'success' }
        } catch (e) {
            instance._log('error', 'HTTP rack patch failed', { error: e?.message })
            reply.code(500)
            return { status: 500, error: e?.message }
        }
    })

    const host  = '0.0.0.0'
    try {
        await fastify.listen({ port: instance._http.port, host: host })
        instance._http.server = fastify
        instance._http.started = true
        instance._log('info', `HTTP server started, listening on ${host}:${instance._http.port}`)
    } catch (err) {
        instance._log('error', `Failed to start HTTP server on ${host}:${instance._http.port}`)
    }
}

const _stopHttpServer = async function (instance) {
    if (instance._http.server && instance._http.started) {
        try {
            await instance._http.server.close()
            instance._log('info', 'HTTP server stopped')
        } catch (err) {
            instance._log('error', 'Failed to stop HTTP server')
        }
    }
    instance._http.server = null
    instance._http.started = false
}

module.exports = {
    startHttpServer: _startHttpServer,
    stopHttpServer: _stopHttpServer,
}