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
	})
}
