const request = require('supertest')
const { startHttpServer, stopHttpServer } = require('../ui/http')

function createMockInstance() {
	return {
		state: {},
		config: {
			hotPlugin: { channel: 1, mapping: {}, type: 'cc', emptyMapping: [] },
			hotSnapshot: { channel: 2, mapping: {}, type: 'cc', emptyMapping: [] },
		},
		hotPlugin: { channel: 1, mapping: {}, type: 'cc', emptyMapping: [] },
		hotSnapshot: { channel: 2, mapping: {}, type: 'cc', emptyMapping: [] },
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

describe('MIDI Channel Validation', () => {
	let instance

	beforeEach(async () => {
		instance = createMockInstance()
		instance._http.port = 0
		await startHttpServer(instance)
	})

	afterEach(async () => {
		await stopHttpServer(instance)
	})

	test('should reject setting plugin channel to snapshot channel', async () => {
		const res = await request(instance._http.server.server)
			.post('/midi/plugin/update')
			.send({ channel: 2 }) // snapshot channel is 2
		expect(res.status).toBe(400)
		expect(res.body.error).toMatch(/MIDI Channel/)
	})

	test('should reject setting snapshot channel to plugin channel', async () => {
		const res = await request(instance._http.server.server)
			.post('/midi/snapshot/update')
			.send({ channel: 1 }) // plugin channel is 1
		expect(res.status).toBe(400)
		expect(res.body.error).toMatch(/MIDI Channel/)
	})

	test('should allow setting plugin channel to a free channel', async () => {
		const res = await request(instance._http.server.server)
			.post('/midi/plugin/update')
			.send({ channel: 3 })
		expect(res.status).toBe(200)
		expect(instance.hotPlugin.channel).toBe(3)
	})

	test('should allow setting snapshot channel to a free channel', async () => {
		const res = await request(instance._http.server.server)
			.post('/midi/snapshot/update')
			.send({ channel: 4 })
		expect(res.status).toBe(200)
		expect(instance.hotSnapshot.channel).toBe(4)
	})
})

