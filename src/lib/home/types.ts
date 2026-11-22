export interface HomeEntity {
	name: string;
	domain: string;
	state: string;
	areas: string[];
	attributes: Record<string, string>;
}

export interface HomeArea {
	name: string;
	entities: HomeEntity[];
}

export interface HomeState {
	areas: HomeArea[];
	fetchedAt: string;
}

export interface DiscoveredTool {
	name: string;
	title?: string;
	description?: string;
	kind: 'read' | 'mutation' | 'blocked';
}

export interface DiscoveryResult {
	serverName?: string;
	serverVersion?: string;
	tools: DiscoveredTool[];
}

/** Content of the `data-tool-meta` UI part describing a tool call for display. */
export interface ToolCallMeta {
	toolCallId: string;
	kind: 'read' | 'mutation' | 'blocked';
	summary: string;
}
