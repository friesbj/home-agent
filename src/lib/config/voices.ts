export interface VoiceCatalogEntry {
	name: string;
	apiName: string;
	language:
		'English' | 'Portuguese' | 'Spanish' | 'German' | 'French' | 'Hindi' | 'Japanese' | 'Korean';
	regionalInfluence: string | null;
	presentation: 'Feminine' | 'Masculine';
	character: string | null;
	source: 'natural';
}

export const VOICE_CATALOG: readonly VoiceCatalogEntry[] = [
	{
		name: 'Pearl',
		apiName: 'pearl',
		language: 'English',
		regionalInfluence: 'Australian',
		presentation: 'Feminine',
		character: null,
		source: 'natural'
	},
	{
		name: 'Ripple',
		apiName: 'ripple',
		language: 'English',
		regionalInfluence: 'Australian',
		presentation: 'Masculine',
		character: 'Warm and conversational',
		source: 'natural'
	},
	{
		name: 'Halo',
		apiName: 'halo',
		language: 'English',
		regionalInfluence: 'British',
		presentation: 'Feminine',
		character: null,
		source: 'natural'
	},
	{
		name: 'Vesper',
		apiName: 'vesper',
		language: 'English',
		regionalInfluence: 'British',
		presentation: 'Masculine',
		character: 'Clear and direct',
		source: 'natural'
	},
	{
		name: 'Willow',
		apiName: 'willow',
		language: 'English',
		regionalInfluence: 'Irish',
		presentation: 'Feminine',
		character: 'Expressive and bright',
		source: 'natural'
	},
	{
		name: 'Stone',
		apiName: 'stone',
		language: 'English',
		regionalInfluence: 'Irish',
		presentation: 'Masculine',
		character: 'Calm and precise',
		source: 'natural'
	},
	{
		name: 'Gleam',
		apiName: 'gleam',
		language: 'English',
		regionalInfluence: 'North American',
		presentation: 'Feminine',
		character: 'Warm and conversational',
		source: 'natural'
	},
	{
		name: 'Meridian',
		apiName: 'meridian',
		language: 'English',
		regionalInfluence: 'North American',
		presentation: 'Masculine',
		character: 'Grounded and measured',
		source: 'natural'
	},
	{
		name: 'Bossa',
		apiName: 'bossa',
		language: 'Portuguese',
		regionalInfluence: 'Brazilian',
		presentation: 'Feminine',
		character: 'Clear and direct',
		source: 'natural'
	},
	{
		name: 'Tempo',
		apiName: 'tempo',
		language: 'Portuguese',
		regionalInfluence: 'Brazilian',
		presentation: 'Masculine',
		character: null,
		source: 'natural'
	},
	{
		name: 'Calandria',
		apiName: 'calandria',
		language: 'Spanish',
		regionalInfluence: 'Argentine',
		presentation: 'Feminine',
		character: null,
		source: 'natural'
	},
	{
		name: 'Compás',
		apiName: 'compas',
		language: 'Spanish',
		regionalInfluence: 'Argentine',
		presentation: 'Masculine',
		character: null,
		source: 'natural'
	},
	{
		name: 'Hornero',
		apiName: 'hornero',
		language: 'Spanish',
		regionalInfluence: 'Argentine',
		presentation: 'Masculine',
		character: null,
		source: 'natural'
	},
	{
		name: 'Luciérnaga',
		apiName: 'luciernaga',
		language: 'Spanish',
		regionalInfluence: 'Mexican',
		presentation: 'Feminine',
		character: null,
		source: 'natural'
	},
	{
		name: 'Destello',
		apiName: 'destello',
		language: 'Spanish',
		regionalInfluence: 'Mexican',
		presentation: 'Masculine',
		character: null,
		source: 'natural'
	},
	{
		name: 'Nuri',
		apiName: 'nuri',
		language: 'German',
		regionalInfluence: null,
		presentation: 'Feminine',
		character: null,
		source: 'natural'
	},
	{
		name: 'Juni',
		apiName: 'juni',
		language: 'German',
		regionalInfluence: null,
		presentation: 'Feminine',
		character: null,
		source: 'natural'
	},
	{
		name: 'Flitz',
		apiName: 'flitz',
		language: 'German',
		regionalInfluence: null,
		presentation: 'Masculine',
		character: null,
		source: 'natural'
	},
	{
		name: 'Brise',
		apiName: 'brise',
		language: 'French',
		regionalInfluence: null,
		presentation: 'Feminine',
		character: null,
		source: 'natural'
	},
	{
		name: 'Sillage',
		apiName: 'sillage',
		language: 'French',
		regionalInfluence: null,
		presentation: 'Masculine',
		character: null,
		source: 'natural'
	},
	{
		name: 'Nira',
		apiName: 'nira',
		language: 'Hindi',
		regionalInfluence: null,
		presentation: 'Feminine',
		character: null,
		source: 'natural'
	},
	{
		name: 'Harema',
		apiName: 'harema',
		language: 'Japanese',
		regionalInfluence: null,
		presentation: 'Feminine',
		character: null,
		source: 'natural'
	},
	{
		name: 'Shida',
		apiName: 'shida',
		language: 'Japanese',
		regionalInfluence: null,
		presentation: 'Masculine',
		character: null,
		source: 'natural'
	},
	{
		name: 'Noeul',
		apiName: 'noeul',
		language: 'Korean',
		regionalInfluence: null,
		presentation: 'Feminine',
		character: null,
		source: 'natural'
	}
] as const;

export const VOICE_API_NAMES = VOICE_CATALOG.map((voice) => voice.apiName) as [string, ...string[]];

export const DEFAULT_VOICE_ENTRY = VOICE_CATALOG.find((voice) => voice.apiName === 'gleam')!;
