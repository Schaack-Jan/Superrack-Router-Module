const request = require('supertest')
const { startHttpServer, stopHttpServer } = require('../ui/http')

function createMockInstance() {
	const instance = {
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
	return instance
}

describe('HTTP server lifecycle and endpoints (integration)', () => {
	let instance

	beforeEach(async () => {
		instance = createMockInstance()
		// Use an ephemeral port (0) and then query fastify server directly via supertest
		instance._http.port = 0
		await startHttpServer(instance)
	})

	afterEach(async () => {
		await stopHttpServer(instance)
	})

	test('health endpoint responds', async () => {
		const res = await request(instance._http.server.server).get('/health')
		expect(res.status).toBe(200)
		expect(res.body.status).toBe('ok')
	})

	test('mappings endpoint returns defaults', async () => {
		const res = await request(instance._http.server.server).get('/patch/mappings')
		expect(res.status).toBe(200)
		expect(res.body.success).toBe(true)
		expect(Array.isArray(res.body.mapping)).toBe(true)
	})

	test('update endpoint applies mapping', async () => {
		const payload = { mapping: [{ id: 2, value: 33 }] }
		const res = await request(instance._http.server.server).post('/patch/update').send(payload)
		expect(res.status).toBe(200)
		expect(instance.config.racks.length).toBe(1)
		expect(instance.config.racks[0].value).toBe(33)
	})

	test('rack patch endpoint validates', async () => {
		let res = await request(instance._http.server.server).patch('/rack/abc').send({ value: 1 })
		expect(res.status).toBe(400)
		res = await request(instance._http.server.server).patch('/rack/1').send({ value: 'x' })
		expect(res.status).toBe(400)
		res = await request(instance._http.server.server).patch('/rack/1').send({ value: 9 })
		expect(res.status).toBe(200)
	})
})
