document.addEventListener('DOMContentLoaded', function () {

	new SlimSelect({
		select: '#settings-select-texture',
		showSearch: false,
	}),
	new SlimSelect({
		select: '#settings-select-lang',
		showSearch: false,
	})
    new SlimSelect({
		select: '#settings-select-light',
		showSearch: false,
	})
    new SlimSelect({
		select: '#settings-select-chunk_geometry_mode',
		showSearch: false,
	})

	new SlimSelect({
		select: '#settings-select-chunk_geometry_alloc',
		showSearch: false,
	})
	//
}, false);