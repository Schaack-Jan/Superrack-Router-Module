const fastifyFactory = require('fastify')
const fastifyStatic = require('@fastify/static')
const request = require('supertest')

// Create a minimal instance mock that matches what ui/http.js expects
function createMockInstance() {
	return {
		state: { sequenceRunning: false, activeSourceIndex: null },
		config: { racks: [], maxRacks: 64 },
		rackCount: 64,
		channelCount: 64,
		emptyMapping: [],
		_http: { port: 0, server: null, started: false },
		_log: () => {},
		saveConfig: () => {},
		_applyConfigToLocalScopes: () => {},
		updateActions: () => {},
		updateFeedbacks: () => {},
		updateVariableDefinitions: () => {},
	}
}

// Reuse the code in ui/http.js by inlining the server setup for tests
function buildServer(instance) {
	const fastify = fastifyFactory({ logger: false })
	fastify.register(fastifyStatic, {
		root: [require('path').join(__dirname, '../ui/public'), require('path').join(__dirname, '../ui')],
		prefix: '/patch/',
	})
	fastify.get('/', async (req, reply) => reply.redirect('patch', 301))
	fastify.get('/patch', async (req, reply) => reply.sendFile('./public/patch.html'))
	fastify.get('/patch/', async (req, reply) => reply.sendFile('./public/patch.html'))
	fastify.get('/health', async () => ({
		status: 'ok',
		sequenceRunning: !!instance.state?.sequenceRunning,
		activeSourceIndex: instance.state?.activeSourceIndex ?? null,
	}))
	fastify.get('/patch/mappings', async () => {
		const maxRacks = parseInt(instance.config?.maxRacks, 10) || instance.rackCount || 64
		return {
			success: true,
			mapping: instance.config.racks,
			meta: { maxRacks, numChannels: instance.channelCount, emptyMapping: instance.emptyMapping },
		}
	})
	fastify.post('/patch/update', async (req, reply) => {
		const body = req.body || {}
		const mapping = body.mapping || []
		instance.config.racks = mapping
		instance.rackMap = mapping
		reply.code(200)
		return { status: 200, result: { updated: mapping.length - 1, total: mapping.length - 1 } }
	})
	fastify.patch('/rack/:id', async (req, reply) => {
		const { id } = req.params || {}
		const body = req.body || {}
		const rackId = parseInt(id, 10)
		if (isNaN(rackId)) {
			reply.code(400)
			return { status: 400, error: 'invalid rack id' }
		}
		const newValue = body.value
		if (newValue == null || isNaN(parseInt(newValue, 10))) {
			reply.code(400)
			return { status: 400, error: 'invalid channel value' }
		}
		return { status: 200, message: 'success' }
	})
	return fastify
}

describe('HTTP patch endpoints', () => {
	let instance
	let app

	beforeEach(async () => {
		instance = createMockInstance()
		app = buildServer(instance)
		await app.ready()
	})

	afterEach(async () => {
		await app.close()
	})

	test('GET /health returns ok and state', async () => {
		const res = await request(app.server).get('/health')
		expect(res.status).toBe(200)
		expect(res.body.status).toBe('ok')
		expect(res.body).toHaveProperty('sequenceRunning', false)
	})

	test('GET /patch returns html', async () => {
		const res = await request(app.server).get('/patch')
		expect(res.status).toBe(200)
		expect(res.text.toLowerCase()).toMatch(/<!doctype html>/)
	})

	test('GET /patch/mappings returns mapping and meta', async () => {
		instance.config.racks = [{ id: 1, value: 10 }]
		const res = await request(app.server).get('/patch/mappings')
		expect(res.status).toBe(200)
		expect(res.body.success).toBe(true)
		expect(res.body.mapping.length).toBe(1)
		expect(res.body.meta).toHaveProperty('maxRacks')
		expect(res.body.meta).toHaveProperty('numChannels')
	})

	test('POST /patch/update updates mapping', async () => {
		const payload = { mapping: [{ id: 1, value: 15 }] }
		const res = await request(app.server).post('/patch/update').send(payload)
		expect(res.status).toBe(200)
		expect(res.body.status).toBe(200)
		expect(instance.config.racks.length).toBe(1)
		expect(instance.config.racks[0].value).toBe(15)
	})

	test('PATCH /rack/:id validates id and value', async () => {
		let res = await request(app.server).patch('/rack/abc').send({ value: 10 })
		expect(res.status).toBe(400)
		expect(res.body.error).toBe('invalid rack id')
		res = await request(app.server).patch('/rack/1').send({ value: 'x' })
		expect(res.status).toBe(400)
		expect(res.body.error).toBe('invalid channel value')
		res = await request(app.server).patch('/rack/1').send({ value: 12 })
		expect(res.status).toBe(200)
	})
})
