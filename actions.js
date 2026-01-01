module.exports = function (self) {
	const rackChoices = self._buildRackChoices ? self._buildRackChoices() : []
	const hotSnapshotChoices = self._buildHotSnapshotChoices ? self._buildHotSnapshotChoices() : []
	const hotPluginChoices = self._buildHotPluginChoices ? self._buildHotPluginChoices() : []

	self.setActionDefinitions({
		route_rack: {
			name: 'Route Rack',
			options: [{ id: 'rackId', type: 'dropdown', label: 'Rack', choices: rackChoices, default: rackChoices[0]?.id }],
			callback: async (event) => {
				await self.routeRack(event.options.rackId)
			},
		},
		route_hot_snapshots: {
			name: 'Route Hot Snapshot',
			options: [
				{
					id: 'snapshotId',
					type: 'dropdown',
					label: 'Hot Snapshot',
					choices: hotSnapshotChoices,
					default: hotSnapshotChoices[0]?.id,
				},
			],
			callback: async (event) => {
				await self.routeSnapshot(event.options.snapshotId)
			},
		},
		route_hot_plugins: {
			name: 'Route Hot Plugin',
			options: [
				{
					id: 'pluginId',
					type: 'dropdown',
					label: 'Hot Plugin',
					choices: hotPluginChoices,
					default: hotPluginChoices[0]?.id,
				},
			],
			callback: async (event) => {
				await self.routePlugin(event.options.pluginId)
			},
		},
		trigger_channel: {
			name: 'Trigger Channel',
			options: [
				{
					id: 'channel',
					type: 'dropdown',
					label: 'Channel (Int)',
					choices: Array.from({ length: self.channelCount }, (_, i) => ({ id: String(i + 1), label: `Channel ${String(i + 1)}` })),
					default: '1',
				},
			],
			callback: async (event) => {
				const channel = parseInt(event.options.channel, 10)
				let rackId = self.rackMap?.[channel]
				if (typeof rackId === 'object' && rackId !== null && 'id' in rackId) {
					rackId = rackId.id
				}
				if (rackId) {
					await self.routeRack(rackId)
				} else {
					self.log('warn', `No rack found for channel ${channel} in rackMap.`)
				}
			},
		},
	})
}
