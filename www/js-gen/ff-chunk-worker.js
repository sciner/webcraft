'use strict';

function _interopNamespace(e) {
	if (e && e.__esModule) return e;
	var n = Object.create(null);
	if (e) {
		Object.keys(e).forEach(function (k) {
			if (k !== 'default') {
				var d = Object.getOwnPropertyDescriptor(e, k);
				Object.defineProperty(n, k, d.get ? d : {
					enumerable: true,
					get: function () { return e[k]; }
				});
			}
		});
	}
	n["default"] = e;
	return Object.freeze(n);
}

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

function getDefaultExportFromNamespaceIfPresent (n) {
	return n && Object.prototype.hasOwnProperty.call(n, 'default') ? n['default'] : n;
}

function getDefaultExportFromNamespaceIfNotNamed (n) {
	return n && Object.prototype.hasOwnProperty.call(n, 'default') && Object.keys(n).length === 1 ? n['default'] : n;
}

function getAugmentedNamespace(n) {
  var f = n.default;
	if (typeof f == "function") {
		var a = function () {
			return f.apply(this, arguments);
		};
		a.prototype = f.prototype;
  } else a = {};
  Object.defineProperty(a, '__esModule', {value: true});
	Object.keys(n).forEach(function (k) {
		var d = Object.getOwnPropertyDescriptor(n, k);
		Object.defineProperty(a, k, d.get ? d : {
			enumerable: true,
			get: function () {
				return n[k];
			}
		});
	});
	return a;
}

var chunk_worker = {};

// Modules
let Vector$2              = null;
let Helpers$1             = null;
let getChunkAddr$1        = null;
let VectorCollector$1     = null;
// let BLOCK               = null;
let WorkerWorldManager$1  = null;
let worlds              = null;
// let world               = null;

const CHUNK_SIZE_X$1 = 16;

const worker$1 = globalThis.worker = {

    init: function() {
        if(typeof process !== 'undefined') {
            Promise.resolve().then(function () { return /*#__PURE__*/_interopNamespace(require('fs')); }).then(fs => commonjsGlobal.fs = fs);
            Promise.resolve().then(function () { return /*#__PURE__*/_interopNamespace(require('path')); }).then(module => commonjsGlobal.path = module);
            Promise.resolve().then(function () { return /*#__PURE__*/_interopNamespace(require('worker_threads')); }).then(module => {
                this.parentPort = module.parentPort;
                this.parentPort.on('message', onMessageFunc);
                //options.context.parentPort = module.parentPort;
                //options.context.parentPort.on('message', onMessageFunc);
                
            });
        } else {
            onmessage = onMessageFunc;
        }
    },

    postMessage: function(message) {
        if(this.parentPort) {
            this.parentPort.postMessage(message);
        } else {
            postMessage(message);
        }
    }

};

worker$1.init();

preLoad().then();

async function preLoad () {
    const start = performance.now();

    await Promise.resolve().then(function () { return helpers; }).then(module => {
        Vector$2 = module.Vector;
        Helpers$1 = module.Helpers;
        VectorCollector$1 = module.VectorCollector;
    });
    // load module
    await Promise.resolve().then(function () { return world$1; }).then(module => {
        WorkerWorldManager$1 = module.WorkerWorldManager;
    });
    // load module
    await Promise.resolve().then(function () { return chunk_const; }).then(module => {
        getChunkAddr$1 = module.getChunkAddr;
    });
    // load module
    await Promise.resolve().then(function () { return blocks; }).then(module => {
        globalThis.BLOCK = module.BLOCK;
        // return BLOCK.init(settings);
    });

    console.debug('[ChunkWorker] Preloaded, load time:', performance.now() - start);
}
/**
* @param {string} terrain_type
*/
async function initWorld(
    generator,
    world_seed,
    world_guid,
    settings,
    cache
) {
    if (cache) {
        Helpers$1.setCache(cache);
    }

    // legacy
    if (!globalThis.BLOCK) {
        await preLoad();
    }

    await globalThis.BLOCK.init(settings);
    //
    worlds = new WorkerWorldManager$1();
    await worlds.InitTerrainGenerators([generator.id]);
    globalThis.world = await worlds.add(generator, world_seed, world_guid);
    // Worker inited
    worker$1.postMessage(['world_inited', null]);
}

// On message callback function
async function onMessageFunc(e) {
    let data = e;
    if(typeof e == 'object' && 'data' in e) {
        data = e.data;
    }
    const cmd = data[0];
    const args = data[1];
    if(cmd == 'init') {
        // Init modules
        return await initWorld(
            args.generator,
            args.world_seed,
            args.world_guid,
            args.settings,
            args.resource_cache
        );
    }
    switch(cmd) {
        case 'createChunk': {
            for(let i = 0; i < args.length; i++) {
                const item = args[i];
                let from_cache = world.chunks.has(item.addr);
                const update = ('update' in item) && item.update;
                if(update) {
                    if(from_cache) {
                        world.chunks.delete(item.addr);
                        from_cache = false;
                    }
                }
                if(from_cache) {
                    let chunk = world.chunks.get(item.addr);
                    const non_zero = chunk.tblocks.refreshNonZero();
                    worker$1.postMessage(['blocks_generated', {
                        key:            chunk.key,
                        addr:           chunk.addr,
                        tblocks:        non_zero > 0 ? chunk.tblocks.saveState() : null,
                        ticking_blocks: Array.from(chunk.ticking_blocks.keys()),
                        map:            chunk.map
                    }]);
                } else {
                    let ci = world.createChunk(item);
                    const non_zero = ci.tblocks.refreshNonZero();
                    const ci2 = {
                        addr: ci.addr,
                        // key: ci.key,
                        tblocks: non_zero > 0 ? ci.tblocks.saveState() : null,
                        ticking_blocks: ci.ticking_blocks
                    };
                    worker$1.postMessage(['blocks_generated', ci2]);
                }
            }
            break;
        }
        case 'destructChunk': {
            for(let addr of args) {
                world.destructChunk(addr);
            }
            break;
        }
        case 'destroyMap': {
            if(world.generator.maps) {
                world.generator.maps.destroyAroundPlayers(args.players);
            }
            break;
        }
        case 'buildVertices': {
            let results = [];
            for (let ind = 0; ind < args.addrs.length; ind++) {
                let addr = args.addrs[ind];
                let dataOffset = args.offsets[ind];

                let chunk = world.chunks.get(addr);
                if(chunk) {
                    chunk.dataOffset = dataOffset;
                    // 4. Rebuild vertices list
                    const item = buildVertices(chunk, false);
                    if(item) {
                        item.dirt_colors = new Float32Array(chunk.size.x * chunk.size.z * 2);
                        let index = 0;
                        for(let z = 0; z < chunk.size.z; z++) {
                            for(let x = 0; x < chunk.size.x; x++) {
                                item.dirt_colors[index++] = chunk.map.cells[z * CHUNK_SIZE_X$1 + x].dirt_color.r;
                                item.dirt_colors[index++] = chunk.map.cells[z * CHUNK_SIZE_X$1 + x].dirt_color.g;
                            }
                        }
                        results.push(item);
                        chunk.vertices = null;
                    }
                }
            }
            worker$1.postMessage(['vertices_generated', results]);
            break;
        }
        case 'setBlock': {
            let chunks = new VectorCollector$1();
            let chunk_addr = new Vector$2(0, 0, 0);
            const pos_world = new Vector$2(0, 0, 0);
            for(let i = 0; i < args.length; i++) {
                const m = args[i];
                // 1. Get chunk
                getChunkAddr$1(m.pos.x, m.pos.y, m.pos.z, chunk_addr);
                let chunk = world.getChunk(chunk_addr);
                if(chunk) {
                    // 2. Set block
                    if(m.type) {
                        chunk.setBlock(m.pos.x, m.pos.y, m.pos.z, m.type, m.is_modify, m.power, m.rotate, null, m.extra_data);
                    }
                    pos_world.set(m.pos.x - chunk.coord.x, m.pos.y - chunk.coord.y, m.pos.z - chunk.coord.z);
                    // 3. Clear vertices for block and around near
                    chunk.setDirtyBlocks(pos_world);
                    chunks.set(chunk_addr, chunk);
                } else {
                    console.error('worker.setBlock: chunk not found at addr: ', m.addr);
                }
            }
            // 4. Rebuild vertices list
            let result = [];
            for(let chunk of chunks) {
                let item = buildVertices(chunk, false);
                if(item) {
                    result.push(item);
                    chunk.vertices = null;
                } else {
                    chunk.dirty = true;
                }
            }
            // 5. Send result to chunk manager
            worker$1.postMessage(['vertices_generated', result]);
            break;
        }
        case 'stat': {
            try {
                console.table({
                    maps_cache_count: world.generator.maps_cache.size,
                    maps_cache_size: JSON.stringify(world.generator.maps_cache).length/1024/1024,
                    chunks_count: world.chunks.size,
                });
            } catch(e) {
                console.error(e);
            }
            break;
        }
        case 'createMaps': {
            /*let pn = performance.now();
            const addr = new Vector(args.addr);
            const maps = world.generator.maps.generateAround(chunk, addr, false, false, 8);
            const CELLS_COUNT = 256;
            const CELL_LENGTH = 4;
            const resp = new Float32Array(new Array((CELLS_COUNT * CELL_LENGTH + CELL_LENGTH) * maps.length));
            let offset = 0;
            for(let map of maps) {
                resp[offset + 0] = map.chunk.addr.x;
                resp[offset + 1] = map.chunk.addr.y;
                resp[offset + 2] = map.chunk.addr.z;
                resp[offset + 3] = 0;
                offset += CELL_LENGTH;
                for(let x = 0; x < map.cells.length; x++) {
                    const line = map.cells[x];
                    for(let z = 0; z < line.length; z++) {
                        const cell = line[z];
                        resp[offset + 0] = cell.value2;
                        resp[offset + 1] = cell.dirt_block_id;
                        resp[offset + 2] = cell.dirt_color.r;
                        resp[offset + 3] = cell.dirt_color.g;
                        offset += CELL_LENGTH;
                    }
                }
            }
            console.log(performance.now() - pn);
            worker.postMessage(['maps_created', resp]);
            */
            break;
        }
    }
}

if(typeof process !== 'undefined') {
    Promise.resolve().then(function () { return /*#__PURE__*/_interopNamespace(require('worker_threads')); }).then(module => module.parentPort.on('message', onMessageFunc));
} else {
    onmessage = onMessageFunc;
}

// Rebuild vertices list
function buildVertices(chunk, return_map) {
    let prev_dirty = chunk.dirty;
    let pm = performance.now();
    chunk.dirty = true;
    let is_builded = chunk.buildVertices();
    if(!is_builded) {
        chunk.dirty = prev_dirty;
        return null;
    }
    chunk.timers.build_vertices = Math.round((performance.now() - pm) * 1000) / 1000;
    let resp = {
        key:                    chunk.key,
        addr:                   chunk.addr,
        vertices:               Object.fromEntries(chunk.vertices),
        gravity_blocks:         chunk.gravity_blocks,
        fluid_blocks:           chunk.fluid_blocks,
        timers:                 chunk.timers,
        tm:                     chunk.tm,
    };
    if(return_map) {
        resp.map = chunk.map;
    }
    return resp;
}

/*!
@fileoverview gl-matrix - High performance matrix and vector operations
@author Brandon Jones
@author Colin MacKenzie IV
@version 3.3.0

Copyright (c) 2015-2021, Brandon Jones, Colin MacKenzie IV.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/
!function(t,n){"object"==typeof exports&&"undefined"!=typeof module?n(exports):"function"==typeof define&&define.amd?define(["exports"],n):n((t="undefined"!=typeof globalThis?globalThis:t||self).glMatrix={});}(undefined,(function(t){"use strict";var n=1e-6,a="undefined"!=typeof Float32Array?Float32Array:Array,r=Math.random,u="zyx";var e=Math.PI/180;Math.hypot||(Math.hypot=function(){for(var t=0,n=arguments.length;n--;)t+=arguments[n]*arguments[n];return Math.sqrt(t)});var o=Object.freeze({__proto__:null,EPSILON:n,get ARRAY_TYPE(){return a},RANDOM:r,ANGLE_ORDER:u,setMatrixArrayType:function(t){a=t;},toRadian:function(t){return t*e},equals:function(t,a){return Math.abs(t-a)<=n*Math.max(1,Math.abs(t),Math.abs(a))}});function i(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=a[0],h=a[1],c=a[2],s=a[3];return t[0]=r*i+e*h,t[1]=u*i+o*h,t[2]=r*c+e*s,t[3]=u*c+o*s,t}function h(t,n,a){return t[0]=n[0]-a[0],t[1]=n[1]-a[1],t[2]=n[2]-a[2],t[3]=n[3]-a[3],t}var c=i,s=h,M=Object.freeze({__proto__:null,create:function(){var t=new a(4);return a!=Float32Array&&(t[1]=0,t[2]=0),t[0]=1,t[3]=1,t},clone:function(t){var n=new a(4);return n[0]=t[0],n[1]=t[1],n[2]=t[2],n[3]=t[3],n},copy:function(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t},identity:function(t){return t[0]=1,t[1]=0,t[2]=0,t[3]=1,t},fromValues:function(t,n,r,u){var e=new a(4);return e[0]=t,e[1]=n,e[2]=r,e[3]=u,e},set:function(t,n,a,r,u){return t[0]=n,t[1]=a,t[2]=r,t[3]=u,t},transpose:function(t,n){if(t===n){var a=n[1];t[1]=n[2],t[2]=a;}else t[0]=n[0],t[1]=n[2],t[2]=n[1],t[3]=n[3];return t},invert:function(t,n){var a=n[0],r=n[1],u=n[2],e=n[3],o=a*e-u*r;return o?(o=1/o,t[0]=e*o,t[1]=-r*o,t[2]=-u*o,t[3]=a*o,t):null},adjoint:function(t,n){var a=n[0];return t[0]=n[3],t[1]=-n[1],t[2]=-n[2],t[3]=a,t},determinant:function(t){return t[0]*t[3]-t[2]*t[1]},multiply:i,rotate:function(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=Math.sin(a),h=Math.cos(a);return t[0]=r*h+e*i,t[1]=u*h+o*i,t[2]=r*-i+e*h,t[3]=u*-i+o*h,t},scale:function(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=a[0],h=a[1];return t[0]=r*i,t[1]=u*i,t[2]=e*h,t[3]=o*h,t},fromRotation:function(t,n){var a=Math.sin(n),r=Math.cos(n);return t[0]=r,t[1]=a,t[2]=-a,t[3]=r,t},fromScaling:function(t,n){return t[0]=n[0],t[1]=0,t[2]=0,t[3]=n[1],t},str:function(t){return "mat2("+t[0]+", "+t[1]+", "+t[2]+", "+t[3]+")"},frob:function(t){return Math.hypot(t[0],t[1],t[2],t[3])},LDU:function(t,n,a,r){return t[2]=r[2]/r[0],a[0]=r[0],a[1]=r[1],a[3]=r[3]-t[2]*a[1],[t,n,a]},add:function(t,n,a){return t[0]=n[0]+a[0],t[1]=n[1]+a[1],t[2]=n[2]+a[2],t[3]=n[3]+a[3],t},subtract:h,exactEquals:function(t,n){return t[0]===n[0]&&t[1]===n[1]&&t[2]===n[2]&&t[3]===n[3]},equals:function(t,a){var r=t[0],u=t[1],e=t[2],o=t[3],i=a[0],h=a[1],c=a[2],s=a[3];return Math.abs(r-i)<=n*Math.max(1,Math.abs(r),Math.abs(i))&&Math.abs(u-h)<=n*Math.max(1,Math.abs(u),Math.abs(h))&&Math.abs(e-c)<=n*Math.max(1,Math.abs(e),Math.abs(c))&&Math.abs(o-s)<=n*Math.max(1,Math.abs(o),Math.abs(s))},multiplyScalar:function(t,n,a){return t[0]=n[0]*a,t[1]=n[1]*a,t[2]=n[2]*a,t[3]=n[3]*a,t},multiplyScalarAndAdd:function(t,n,a,r){return t[0]=n[0]+a[0]*r,t[1]=n[1]+a[1]*r,t[2]=n[2]+a[2]*r,t[3]=n[3]+a[3]*r,t},mul:c,sub:s});function f(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=n[4],h=n[5],c=a[0],s=a[1],M=a[2],f=a[3],l=a[4],v=a[5];return t[0]=r*c+e*s,t[1]=u*c+o*s,t[2]=r*M+e*f,t[3]=u*M+o*f,t[4]=r*l+e*v+i,t[5]=u*l+o*v+h,t}function l(t,n,a){return t[0]=n[0]-a[0],t[1]=n[1]-a[1],t[2]=n[2]-a[2],t[3]=n[3]-a[3],t[4]=n[4]-a[4],t[5]=n[5]-a[5],t}var v=f,b=l,m=Object.freeze({__proto__:null,create:function(){var t=new a(6);return a!=Float32Array&&(t[1]=0,t[2]=0,t[4]=0,t[5]=0),t[0]=1,t[3]=1,t},clone:function(t){var n=new a(6);return n[0]=t[0],n[1]=t[1],n[2]=t[2],n[3]=t[3],n[4]=t[4],n[5]=t[5],n},copy:function(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t},identity:function(t){return t[0]=1,t[1]=0,t[2]=0,t[3]=1,t[4]=0,t[5]=0,t},fromValues:function(t,n,r,u,e,o){var i=new a(6);return i[0]=t,i[1]=n,i[2]=r,i[3]=u,i[4]=e,i[5]=o,i},set:function(t,n,a,r,u,e,o){return t[0]=n,t[1]=a,t[2]=r,t[3]=u,t[4]=e,t[5]=o,t},invert:function(t,n){var a=n[0],r=n[1],u=n[2],e=n[3],o=n[4],i=n[5],h=a*e-r*u;return h?(h=1/h,t[0]=e*h,t[1]=-r*h,t[2]=-u*h,t[3]=a*h,t[4]=(u*i-e*o)*h,t[5]=(r*o-a*i)*h,t):null},determinant:function(t){return t[0]*t[3]-t[1]*t[2]},multiply:f,rotate:function(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=n[4],h=n[5],c=Math.sin(a),s=Math.cos(a);return t[0]=r*s+e*c,t[1]=u*s+o*c,t[2]=r*-c+e*s,t[3]=u*-c+o*s,t[4]=i,t[5]=h,t},scale:function(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=n[4],h=n[5],c=a[0],s=a[1];return t[0]=r*c,t[1]=u*c,t[2]=e*s,t[3]=o*s,t[4]=i,t[5]=h,t},translate:function(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=n[4],h=n[5],c=a[0],s=a[1];return t[0]=r,t[1]=u,t[2]=e,t[3]=o,t[4]=r*c+e*s+i,t[5]=u*c+o*s+h,t},fromRotation:function(t,n){var a=Math.sin(n),r=Math.cos(n);return t[0]=r,t[1]=a,t[2]=-a,t[3]=r,t[4]=0,t[5]=0,t},fromScaling:function(t,n){return t[0]=n[0],t[1]=0,t[2]=0,t[3]=n[1],t[4]=0,t[5]=0,t},fromTranslation:function(t,n){return t[0]=1,t[1]=0,t[2]=0,t[3]=1,t[4]=n[0],t[5]=n[1],t},str:function(t){return "mat2d("+t[0]+", "+t[1]+", "+t[2]+", "+t[3]+", "+t[4]+", "+t[5]+")"},frob:function(t){return Math.hypot(t[0],t[1],t[2],t[3],t[4],t[5],1)},add:function(t,n,a){return t[0]=n[0]+a[0],t[1]=n[1]+a[1],t[2]=n[2]+a[2],t[3]=n[3]+a[3],t[4]=n[4]+a[4],t[5]=n[5]+a[5],t},subtract:l,multiplyScalar:function(t,n,a){return t[0]=n[0]*a,t[1]=n[1]*a,t[2]=n[2]*a,t[3]=n[3]*a,t[4]=n[4]*a,t[5]=n[5]*a,t},multiplyScalarAndAdd:function(t,n,a,r){return t[0]=n[0]+a[0]*r,t[1]=n[1]+a[1]*r,t[2]=n[2]+a[2]*r,t[3]=n[3]+a[3]*r,t[4]=n[4]+a[4]*r,t[5]=n[5]+a[5]*r,t},exactEquals:function(t,n){return t[0]===n[0]&&t[1]===n[1]&&t[2]===n[2]&&t[3]===n[3]&&t[4]===n[4]&&t[5]===n[5]},equals:function(t,a){var r=t[0],u=t[1],e=t[2],o=t[3],i=t[4],h=t[5],c=a[0],s=a[1],M=a[2],f=a[3],l=a[4],v=a[5];return Math.abs(r-c)<=n*Math.max(1,Math.abs(r),Math.abs(c))&&Math.abs(u-s)<=n*Math.max(1,Math.abs(u),Math.abs(s))&&Math.abs(e-M)<=n*Math.max(1,Math.abs(e),Math.abs(M))&&Math.abs(o-f)<=n*Math.max(1,Math.abs(o),Math.abs(f))&&Math.abs(i-l)<=n*Math.max(1,Math.abs(i),Math.abs(l))&&Math.abs(h-v)<=n*Math.max(1,Math.abs(h),Math.abs(v))},mul:v,sub:b});function d(){var t=new a(9);return a!=Float32Array&&(t[1]=0,t[2]=0,t[3]=0,t[5]=0,t[6]=0,t[7]=0),t[0]=1,t[4]=1,t[8]=1,t}function p(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=n[4],h=n[5],c=n[6],s=n[7],M=n[8],f=a[0],l=a[1],v=a[2],b=a[3],m=a[4],d=a[5],p=a[6],x=a[7],y=a[8];return t[0]=f*r+l*o+v*c,t[1]=f*u+l*i+v*s,t[2]=f*e+l*h+v*M,t[3]=b*r+m*o+d*c,t[4]=b*u+m*i+d*s,t[5]=b*e+m*h+d*M,t[6]=p*r+x*o+y*c,t[7]=p*u+x*i+y*s,t[8]=p*e+x*h+y*M,t}function x(t,n,a){return t[0]=n[0]-a[0],t[1]=n[1]-a[1],t[2]=n[2]-a[2],t[3]=n[3]-a[3],t[4]=n[4]-a[4],t[5]=n[5]-a[5],t[6]=n[6]-a[6],t[7]=n[7]-a[7],t[8]=n[8]-a[8],t}var y=p,q=x,g=Object.freeze({__proto__:null,create:d,fromMat4:function(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[4],t[4]=n[5],t[5]=n[6],t[6]=n[8],t[7]=n[9],t[8]=n[10],t},clone:function(t){var n=new a(9);return n[0]=t[0],n[1]=t[1],n[2]=t[2],n[3]=t[3],n[4]=t[4],n[5]=t[5],n[6]=t[6],n[7]=t[7],n[8]=t[8],n},copy:function(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t},fromValues:function(t,n,r,u,e,o,i,h,c){var s=new a(9);return s[0]=t,s[1]=n,s[2]=r,s[3]=u,s[4]=e,s[5]=o,s[6]=i,s[7]=h,s[8]=c,s},set:function(t,n,a,r,u,e,o,i,h,c){return t[0]=n,t[1]=a,t[2]=r,t[3]=u,t[4]=e,t[5]=o,t[6]=i,t[7]=h,t[8]=c,t},identity:function(t){return t[0]=1,t[1]=0,t[2]=0,t[3]=0,t[4]=1,t[5]=0,t[6]=0,t[7]=0,t[8]=1,t},transpose:function(t,n){if(t===n){var a=n[1],r=n[2],u=n[5];t[1]=n[3],t[2]=n[6],t[3]=a,t[5]=n[7],t[6]=r,t[7]=u;}else t[0]=n[0],t[1]=n[3],t[2]=n[6],t[3]=n[1],t[4]=n[4],t[5]=n[7],t[6]=n[2],t[7]=n[5],t[8]=n[8];return t},invert:function(t,n){var a=n[0],r=n[1],u=n[2],e=n[3],o=n[4],i=n[5],h=n[6],c=n[7],s=n[8],M=s*o-i*c,f=-s*e+i*h,l=c*e-o*h,v=a*M+r*f+u*l;return v?(v=1/v,t[0]=M*v,t[1]=(-s*r+u*c)*v,t[2]=(i*r-u*o)*v,t[3]=f*v,t[4]=(s*a-u*h)*v,t[5]=(-i*a+u*e)*v,t[6]=l*v,t[7]=(-c*a+r*h)*v,t[8]=(o*a-r*e)*v,t):null},adjoint:function(t,n){var a=n[0],r=n[1],u=n[2],e=n[3],o=n[4],i=n[5],h=n[6],c=n[7],s=n[8];return t[0]=o*s-i*c,t[1]=u*c-r*s,t[2]=r*i-u*o,t[3]=i*h-e*s,t[4]=a*s-u*h,t[5]=u*e-a*i,t[6]=e*c-o*h,t[7]=r*h-a*c,t[8]=a*o-r*e,t},determinant:function(t){var n=t[0],a=t[1],r=t[2],u=t[3],e=t[4],o=t[5],i=t[6],h=t[7],c=t[8];return n*(c*e-o*h)+a*(-c*u+o*i)+r*(h*u-e*i)},multiply:p,translate:function(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=n[4],h=n[5],c=n[6],s=n[7],M=n[8],f=a[0],l=a[1];return t[0]=r,t[1]=u,t[2]=e,t[3]=o,t[4]=i,t[5]=h,t[6]=f*r+l*o+c,t[7]=f*u+l*i+s,t[8]=f*e+l*h+M,t},rotate:function(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=n[4],h=n[5],c=n[6],s=n[7],M=n[8],f=Math.sin(a),l=Math.cos(a);return t[0]=l*r+f*o,t[1]=l*u+f*i,t[2]=l*e+f*h,t[3]=l*o-f*r,t[4]=l*i-f*u,t[5]=l*h-f*e,t[6]=c,t[7]=s,t[8]=M,t},scale:function(t,n,a){var r=a[0],u=a[1];return t[0]=r*n[0],t[1]=r*n[1],t[2]=r*n[2],t[3]=u*n[3],t[4]=u*n[4],t[5]=u*n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t},fromTranslation:function(t,n){return t[0]=1,t[1]=0,t[2]=0,t[3]=0,t[4]=1,t[5]=0,t[6]=n[0],t[7]=n[1],t[8]=1,t},fromRotation:function(t,n){var a=Math.sin(n),r=Math.cos(n);return t[0]=r,t[1]=a,t[2]=0,t[3]=-a,t[4]=r,t[5]=0,t[6]=0,t[7]=0,t[8]=1,t},fromScaling:function(t,n){return t[0]=n[0],t[1]=0,t[2]=0,t[3]=0,t[4]=n[1],t[5]=0,t[6]=0,t[7]=0,t[8]=1,t},fromMat2d:function(t,n){return t[0]=n[0],t[1]=n[1],t[2]=0,t[3]=n[2],t[4]=n[3],t[5]=0,t[6]=n[4],t[7]=n[5],t[8]=1,t},fromQuat:function(t,n){var a=n[0],r=n[1],u=n[2],e=n[3],o=a+a,i=r+r,h=u+u,c=a*o,s=r*o,M=r*i,f=u*o,l=u*i,v=u*h,b=e*o,m=e*i,d=e*h;return t[0]=1-M-v,t[3]=s-d,t[6]=f+m,t[1]=s+d,t[4]=1-c-v,t[7]=l-b,t[2]=f-m,t[5]=l+b,t[8]=1-c-M,t},normalFromMat4:function(t,n){var a=n[0],r=n[1],u=n[2],e=n[3],o=n[4],i=n[5],h=n[6],c=n[7],s=n[8],M=n[9],f=n[10],l=n[11],v=n[12],b=n[13],m=n[14],d=n[15],p=a*i-r*o,x=a*h-u*o,y=a*c-e*o,q=r*h-u*i,g=r*c-e*i,_=u*c-e*h,A=s*b-M*v,w=s*m-f*v,z=s*d-l*v,R=M*m-f*b,O=M*d-l*b,j=f*d-l*m,E=p*j-x*O+y*R+q*z-g*w+_*A;return E?(E=1/E,t[0]=(i*j-h*O+c*R)*E,t[1]=(h*z-o*j-c*w)*E,t[2]=(o*O-i*z+c*A)*E,t[3]=(u*O-r*j-e*R)*E,t[4]=(a*j-u*z+e*w)*E,t[5]=(r*z-a*O-e*A)*E,t[6]=(b*_-m*g+d*q)*E,t[7]=(m*y-v*_-d*x)*E,t[8]=(v*g-b*y+d*p)*E,t):null},projection:function(t,n,a){return t[0]=2/n,t[1]=0,t[2]=0,t[3]=0,t[4]=-2/a,t[5]=0,t[6]=-1,t[7]=1,t[8]=1,t},str:function(t){return "mat3("+t[0]+", "+t[1]+", "+t[2]+", "+t[3]+", "+t[4]+", "+t[5]+", "+t[6]+", "+t[7]+", "+t[8]+")"},frob:function(t){return Math.hypot(t[0],t[1],t[2],t[3],t[4],t[5],t[6],t[7],t[8])},add:function(t,n,a){return t[0]=n[0]+a[0],t[1]=n[1]+a[1],t[2]=n[2]+a[2],t[3]=n[3]+a[3],t[4]=n[4]+a[4],t[5]=n[5]+a[5],t[6]=n[6]+a[6],t[7]=n[7]+a[7],t[8]=n[8]+a[8],t},subtract:x,multiplyScalar:function(t,n,a){return t[0]=n[0]*a,t[1]=n[1]*a,t[2]=n[2]*a,t[3]=n[3]*a,t[4]=n[4]*a,t[5]=n[5]*a,t[6]=n[6]*a,t[7]=n[7]*a,t[8]=n[8]*a,t},multiplyScalarAndAdd:function(t,n,a,r){return t[0]=n[0]+a[0]*r,t[1]=n[1]+a[1]*r,t[2]=n[2]+a[2]*r,t[3]=n[3]+a[3]*r,t[4]=n[4]+a[4]*r,t[5]=n[5]+a[5]*r,t[6]=n[6]+a[6]*r,t[7]=n[7]+a[7]*r,t[8]=n[8]+a[8]*r,t},exactEquals:function(t,n){return t[0]===n[0]&&t[1]===n[1]&&t[2]===n[2]&&t[3]===n[3]&&t[4]===n[4]&&t[5]===n[5]&&t[6]===n[6]&&t[7]===n[7]&&t[8]===n[8]},equals:function(t,a){var r=t[0],u=t[1],e=t[2],o=t[3],i=t[4],h=t[5],c=t[6],s=t[7],M=t[8],f=a[0],l=a[1],v=a[2],b=a[3],m=a[4],d=a[5],p=a[6],x=a[7],y=a[8];return Math.abs(r-f)<=n*Math.max(1,Math.abs(r),Math.abs(f))&&Math.abs(u-l)<=n*Math.max(1,Math.abs(u),Math.abs(l))&&Math.abs(e-v)<=n*Math.max(1,Math.abs(e),Math.abs(v))&&Math.abs(o-b)<=n*Math.max(1,Math.abs(o),Math.abs(b))&&Math.abs(i-m)<=n*Math.max(1,Math.abs(i),Math.abs(m))&&Math.abs(h-d)<=n*Math.max(1,Math.abs(h),Math.abs(d))&&Math.abs(c-p)<=n*Math.max(1,Math.abs(c),Math.abs(p))&&Math.abs(s-x)<=n*Math.max(1,Math.abs(s),Math.abs(x))&&Math.abs(M-y)<=n*Math.max(1,Math.abs(M),Math.abs(y))},mul:y,sub:q});function _(t){return t[0]=1,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=1,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[10]=1,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,t}function A(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=n[4],h=n[5],c=n[6],s=n[7],M=n[8],f=n[9],l=n[10],v=n[11],b=n[12],m=n[13],d=n[14],p=n[15],x=a[0],y=a[1],q=a[2],g=a[3];return t[0]=x*r+y*i+q*M+g*b,t[1]=x*u+y*h+q*f+g*m,t[2]=x*e+y*c+q*l+g*d,t[3]=x*o+y*s+q*v+g*p,x=a[4],y=a[5],q=a[6],g=a[7],t[4]=x*r+y*i+q*M+g*b,t[5]=x*u+y*h+q*f+g*m,t[6]=x*e+y*c+q*l+g*d,t[7]=x*o+y*s+q*v+g*p,x=a[8],y=a[9],q=a[10],g=a[11],t[8]=x*r+y*i+q*M+g*b,t[9]=x*u+y*h+q*f+g*m,t[10]=x*e+y*c+q*l+g*d,t[11]=x*o+y*s+q*v+g*p,x=a[12],y=a[13],q=a[14],g=a[15],t[12]=x*r+y*i+q*M+g*b,t[13]=x*u+y*h+q*f+g*m,t[14]=x*e+y*c+q*l+g*d,t[15]=x*o+y*s+q*v+g*p,t}function w(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=r+r,h=u+u,c=e+e,s=r*i,M=r*h,f=r*c,l=u*h,v=u*c,b=e*c,m=o*i,d=o*h,p=o*c;return t[0]=1-(l+b),t[1]=M+p,t[2]=f-d,t[3]=0,t[4]=M-p,t[5]=1-(s+b),t[6]=v+m,t[7]=0,t[8]=f+d,t[9]=v-m,t[10]=1-(s+l),t[11]=0,t[12]=a[0],t[13]=a[1],t[14]=a[2],t[15]=1,t}function z(t,n){return t[0]=n[12],t[1]=n[13],t[2]=n[14],t}function R(t,n){var a=n[0],r=n[1],u=n[2],e=n[4],o=n[5],i=n[6],h=n[8],c=n[9],s=n[10];return t[0]=Math.hypot(a,r,u),t[1]=Math.hypot(e,o,i),t[2]=Math.hypot(h,c,s),t}function O(t,n){var r=new a(3);R(r,n);var u=1/r[0],e=1/r[1],o=1/r[2],i=n[0]*u,h=n[1]*e,c=n[2]*o,s=n[4]*u,M=n[5]*e,f=n[6]*o,l=n[8]*u,v=n[9]*e,b=n[10]*o,m=i+M+b,d=0;return m>0?(d=2*Math.sqrt(m+1),t[3]=.25*d,t[0]=(f-v)/d,t[1]=(l-c)/d,t[2]=(h-s)/d):i>M&&i>b?(d=2*Math.sqrt(1+i-M-b),t[3]=(f-v)/d,t[0]=.25*d,t[1]=(h+s)/d,t[2]=(l+c)/d):M>b?(d=2*Math.sqrt(1+M-i-b),t[3]=(l-c)/d,t[0]=(h+s)/d,t[1]=.25*d,t[2]=(f+v)/d):(d=2*Math.sqrt(1+b-i-M),t[3]=(h-s)/d,t[0]=(l+c)/d,t[1]=(f+v)/d,t[2]=.25*d),t}function j(t,n,a,r,u){var e=1/Math.tan(n/2);if(t[0]=e/a,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=e,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[11]=-1,t[12]=0,t[13]=0,t[15]=0,null!=u&&u!==1/0){var o=1/(r-u);t[10]=(u+r)*o,t[14]=2*u*r*o;}else t[10]=-1,t[14]=-2*r;return t}var E=j;function P(t,n,a,r,u,e,o){var i=1/(n-a),h=1/(r-u),c=1/(e-o);return t[0]=-2*i,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=-2*h,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[10]=2*c,t[11]=0,t[12]=(n+a)*i,t[13]=(u+r)*h,t[14]=(o+e)*c,t[15]=1,t}var T=P;function S(t,n,a){return t[0]=n[0]-a[0],t[1]=n[1]-a[1],t[2]=n[2]-a[2],t[3]=n[3]-a[3],t[4]=n[4]-a[4],t[5]=n[5]-a[5],t[6]=n[6]-a[6],t[7]=n[7]-a[7],t[8]=n[8]-a[8],t[9]=n[9]-a[9],t[10]=n[10]-a[10],t[11]=n[11]-a[11],t[12]=n[12]-a[12],t[13]=n[13]-a[13],t[14]=n[14]-a[14],t[15]=n[15]-a[15],t}var D=A,F=S,I=Object.freeze({__proto__:null,create:function(){var t=new a(16);return a!=Float32Array&&(t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0),t[0]=1,t[5]=1,t[10]=1,t[15]=1,t},clone:function(t){var n=new a(16);return n[0]=t[0],n[1]=t[1],n[2]=t[2],n[3]=t[3],n[4]=t[4],n[5]=t[5],n[6]=t[6],n[7]=t[7],n[8]=t[8],n[9]=t[9],n[10]=t[10],n[11]=t[11],n[12]=t[12],n[13]=t[13],n[14]=t[14],n[15]=t[15],n},copy:function(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],t},fromValues:function(t,n,r,u,e,o,i,h,c,s,M,f,l,v,b,m){var d=new a(16);return d[0]=t,d[1]=n,d[2]=r,d[3]=u,d[4]=e,d[5]=o,d[6]=i,d[7]=h,d[8]=c,d[9]=s,d[10]=M,d[11]=f,d[12]=l,d[13]=v,d[14]=b,d[15]=m,d},set:function(t,n,a,r,u,e,o,i,h,c,s,M,f,l,v,b,m){return t[0]=n,t[1]=a,t[2]=r,t[3]=u,t[4]=e,t[5]=o,t[6]=i,t[7]=h,t[8]=c,t[9]=s,t[10]=M,t[11]=f,t[12]=l,t[13]=v,t[14]=b,t[15]=m,t},identity:_,transpose:function(t,n){if(t===n){var a=n[1],r=n[2],u=n[3],e=n[6],o=n[7],i=n[11];t[1]=n[4],t[2]=n[8],t[3]=n[12],t[4]=a,t[6]=n[9],t[7]=n[13],t[8]=r,t[9]=e,t[11]=n[14],t[12]=u,t[13]=o,t[14]=i;}else t[0]=n[0],t[1]=n[4],t[2]=n[8],t[3]=n[12],t[4]=n[1],t[5]=n[5],t[6]=n[9],t[7]=n[13],t[8]=n[2],t[9]=n[6],t[10]=n[10],t[11]=n[14],t[12]=n[3],t[13]=n[7],t[14]=n[11],t[15]=n[15];return t},invert:function(t,n){var a=n[0],r=n[1],u=n[2],e=n[3],o=n[4],i=n[5],h=n[6],c=n[7],s=n[8],M=n[9],f=n[10],l=n[11],v=n[12],b=n[13],m=n[14],d=n[15],p=a*i-r*o,x=a*h-u*o,y=a*c-e*o,q=r*h-u*i,g=r*c-e*i,_=u*c-e*h,A=s*b-M*v,w=s*m-f*v,z=s*d-l*v,R=M*m-f*b,O=M*d-l*b,j=f*d-l*m,E=p*j-x*O+y*R+q*z-g*w+_*A;return E?(E=1/E,t[0]=(i*j-h*O+c*R)*E,t[1]=(u*O-r*j-e*R)*E,t[2]=(b*_-m*g+d*q)*E,t[3]=(f*g-M*_-l*q)*E,t[4]=(h*z-o*j-c*w)*E,t[5]=(a*j-u*z+e*w)*E,t[6]=(m*y-v*_-d*x)*E,t[7]=(s*_-f*y+l*x)*E,t[8]=(o*O-i*z+c*A)*E,t[9]=(r*z-a*O-e*A)*E,t[10]=(v*g-b*y+d*p)*E,t[11]=(M*y-s*g-l*p)*E,t[12]=(i*w-o*R-h*A)*E,t[13]=(a*R-r*w+u*A)*E,t[14]=(b*x-v*q-m*p)*E,t[15]=(s*q-M*x+f*p)*E,t):null},adjoint:function(t,n){var a=n[0],r=n[1],u=n[2],e=n[3],o=n[4],i=n[5],h=n[6],c=n[7],s=n[8],M=n[9],f=n[10],l=n[11],v=n[12],b=n[13],m=n[14],d=n[15],p=a*i-r*o,x=a*h-u*o,y=a*c-e*o,q=r*h-u*i,g=r*c-e*i,_=u*c-e*h,A=s*b-M*v,w=s*m-f*v,z=s*d-l*v,R=M*m-f*b,O=M*d-l*b,j=f*d-l*m;return t[0]=i*j-h*O+c*R,t[1]=u*O-r*j-e*R,t[2]=b*_-m*g+d*q,t[3]=f*g-M*_-l*q,t[4]=h*z-o*j-c*w,t[5]=a*j-u*z+e*w,t[6]=m*y-v*_-d*x,t[7]=s*_-f*y+l*x,t[8]=o*O-i*z+c*A,t[9]=r*z-a*O-e*A,t[10]=v*g-b*y+d*p,t[11]=M*y-s*g-l*p,t[12]=i*w-o*R-h*A,t[13]=a*R-r*w+u*A,t[14]=b*x-v*q-m*p,t[15]=s*q-M*x+f*p,t},determinant:function(t){var n=t[0],a=t[1],r=t[2],u=t[3],e=t[4],o=t[5],i=t[6],h=t[7],c=t[8],s=t[9],M=t[10],f=t[11],l=t[12],v=t[13],b=t[14],m=n*o-a*e,d=n*i-r*e,p=a*i-r*o,x=c*v-s*l,y=c*b-M*l,q=s*b-M*v;return h*(n*q-a*y+r*x)-u*(e*q-o*y+i*x)+t[15]*(c*p-s*d+M*m)-f*(l*p-v*d+b*m)},multiply:A,translate:function(t,n,a){var r,u,e,o,i,h,c,s,M,f,l,v,b=a[0],m=a[1],d=a[2];return n===t?(t[12]=n[0]*b+n[4]*m+n[8]*d+n[12],t[13]=n[1]*b+n[5]*m+n[9]*d+n[13],t[14]=n[2]*b+n[6]*m+n[10]*d+n[14],t[15]=n[3]*b+n[7]*m+n[11]*d+n[15]):(r=n[0],u=n[1],e=n[2],o=n[3],i=n[4],h=n[5],c=n[6],s=n[7],M=n[8],f=n[9],l=n[10],v=n[11],t[0]=r,t[1]=u,t[2]=e,t[3]=o,t[4]=i,t[5]=h,t[6]=c,t[7]=s,t[8]=M,t[9]=f,t[10]=l,t[11]=v,t[12]=r*b+i*m+M*d+n[12],t[13]=u*b+h*m+f*d+n[13],t[14]=e*b+c*m+l*d+n[14],t[15]=o*b+s*m+v*d+n[15]),t},scale:function(t,n,a){var r=a[0],u=a[1],e=a[2];return t[0]=n[0]*r,t[1]=n[1]*r,t[2]=n[2]*r,t[3]=n[3]*r,t[4]=n[4]*u,t[5]=n[5]*u,t[6]=n[6]*u,t[7]=n[7]*u,t[8]=n[8]*e,t[9]=n[9]*e,t[10]=n[10]*e,t[11]=n[11]*e,t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],t},rotate:function(t,a,r,u){var e,o,i,h,c,s,M,f,l,v,b,m,d,p,x,y,q,g,_,A,w,z,R,O,j=u[0],E=u[1],P=u[2],T=Math.hypot(j,E,P);return T<n?null:(j*=T=1/T,E*=T,P*=T,e=Math.sin(r),i=1-(o=Math.cos(r)),h=a[0],c=a[1],s=a[2],M=a[3],f=a[4],l=a[5],v=a[6],b=a[7],m=a[8],d=a[9],p=a[10],x=a[11],y=j*j*i+o,q=E*j*i+P*e,g=P*j*i-E*e,_=j*E*i-P*e,A=E*E*i+o,w=P*E*i+j*e,z=j*P*i+E*e,R=E*P*i-j*e,O=P*P*i+o,t[0]=h*y+f*q+m*g,t[1]=c*y+l*q+d*g,t[2]=s*y+v*q+p*g,t[3]=M*y+b*q+x*g,t[4]=h*_+f*A+m*w,t[5]=c*_+l*A+d*w,t[6]=s*_+v*A+p*w,t[7]=M*_+b*A+x*w,t[8]=h*z+f*R+m*O,t[9]=c*z+l*R+d*O,t[10]=s*z+v*R+p*O,t[11]=M*z+b*R+x*O,a!==t&&(t[12]=a[12],t[13]=a[13],t[14]=a[14],t[15]=a[15]),t)},rotateX:function(t,n,a){var r=Math.sin(a),u=Math.cos(a),e=n[4],o=n[5],i=n[6],h=n[7],c=n[8],s=n[9],M=n[10],f=n[11];return n!==t&&(t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15]),t[4]=e*u+c*r,t[5]=o*u+s*r,t[6]=i*u+M*r,t[7]=h*u+f*r,t[8]=c*u-e*r,t[9]=s*u-o*r,t[10]=M*u-i*r,t[11]=f*u-h*r,t},rotateY:function(t,n,a){var r=Math.sin(a),u=Math.cos(a),e=n[0],o=n[1],i=n[2],h=n[3],c=n[8],s=n[9],M=n[10],f=n[11];return n!==t&&(t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15]),t[0]=e*u-c*r,t[1]=o*u-s*r,t[2]=i*u-M*r,t[3]=h*u-f*r,t[8]=e*r+c*u,t[9]=o*r+s*u,t[10]=i*r+M*u,t[11]=h*r+f*u,t},rotateZ:function(t,n,a){var r=Math.sin(a),u=Math.cos(a),e=n[0],o=n[1],i=n[2],h=n[3],c=n[4],s=n[5],M=n[6],f=n[7];return n!==t&&(t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15]),t[0]=e*u+c*r,t[1]=o*u+s*r,t[2]=i*u+M*r,t[3]=h*u+f*r,t[4]=c*u-e*r,t[5]=s*u-o*r,t[6]=M*u-i*r,t[7]=f*u-h*r,t},fromTranslation:function(t,n){return t[0]=1,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=1,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[10]=1,t[11]=0,t[12]=n[0],t[13]=n[1],t[14]=n[2],t[15]=1,t},fromScaling:function(t,n){return t[0]=n[0],t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=n[1],t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[10]=n[2],t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,t},fromRotation:function(t,a,r){var u,e,o,i=r[0],h=r[1],c=r[2],s=Math.hypot(i,h,c);return s<n?null:(i*=s=1/s,h*=s,c*=s,u=Math.sin(a),o=1-(e=Math.cos(a)),t[0]=i*i*o+e,t[1]=h*i*o+c*u,t[2]=c*i*o-h*u,t[3]=0,t[4]=i*h*o-c*u,t[5]=h*h*o+e,t[6]=c*h*o+i*u,t[7]=0,t[8]=i*c*o+h*u,t[9]=h*c*o-i*u,t[10]=c*c*o+e,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,t)},fromXRotation:function(t,n){var a=Math.sin(n),r=Math.cos(n);return t[0]=1,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=r,t[6]=a,t[7]=0,t[8]=0,t[9]=-a,t[10]=r,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,t},fromYRotation:function(t,n){var a=Math.sin(n),r=Math.cos(n);return t[0]=r,t[1]=0,t[2]=-a,t[3]=0,t[4]=0,t[5]=1,t[6]=0,t[7]=0,t[8]=a,t[9]=0,t[10]=r,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,t},fromZRotation:function(t,n){var a=Math.sin(n),r=Math.cos(n);return t[0]=r,t[1]=a,t[2]=0,t[3]=0,t[4]=-a,t[5]=r,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[10]=1,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,t},fromRotationTranslation:w,fromQuat2:function(t,n){var r=new a(3),u=-n[0],e=-n[1],o=-n[2],i=n[3],h=n[4],c=n[5],s=n[6],M=n[7],f=u*u+e*e+o*o+i*i;return f>0?(r[0]=2*(h*i+M*u+c*o-s*e)/f,r[1]=2*(c*i+M*e+s*u-h*o)/f,r[2]=2*(s*i+M*o+h*e-c*u)/f):(r[0]=2*(h*i+M*u+c*o-s*e),r[1]=2*(c*i+M*e+s*u-h*o),r[2]=2*(s*i+M*o+h*e-c*u)),w(t,n,r),t},getTranslation:z,getScaling:R,getRotation:O,decompose:function(t,n,a,r){n[0]=r[12],n[1]=r[13],n[2]=r[14];var u=r[0],e=r[1],o=r[2],i=r[4],h=r[5],c=r[6],s=r[8],M=r[9],f=r[10];a[0]=Math.hypot(u,e,o),a[1]=Math.hypot(i,h,c),a[2]=Math.hypot(s,M,f);var l=1/a[0],v=1/a[1],b=1/a[2],m=u*l,d=e*v,p=o*b,x=i*l,y=h*v,q=c*b,g=s*l,_=M*v,A=f*b,w=m+y+A,z=0;return w>0?(z=2*Math.sqrt(w+1),t[3]=.25*z,t[0]=(q-_)/z,t[1]=(g-p)/z,t[2]=(d-x)/z):m>y&&m>A?(z=2*Math.sqrt(1+m-y-A),t[3]=(q-_)/z,t[0]=.25*z,t[1]=(d+x)/z,t[2]=(g+p)/z):y>A?(z=2*Math.sqrt(1+y-m-A),t[3]=(g-p)/z,t[0]=(d+x)/z,t[1]=.25*z,t[2]=(q+_)/z):(z=2*Math.sqrt(1+A-m-y),t[3]=(d-x)/z,t[0]=(g+p)/z,t[1]=(q+_)/z,t[2]=.25*z),t},fromRotationTranslationScale:function(t,n,a,r){var u=n[0],e=n[1],o=n[2],i=n[3],h=u+u,c=e+e,s=o+o,M=u*h,f=u*c,l=u*s,v=e*c,b=e*s,m=o*s,d=i*h,p=i*c,x=i*s,y=r[0],q=r[1],g=r[2];return t[0]=(1-(v+m))*y,t[1]=(f+x)*y,t[2]=(l-p)*y,t[3]=0,t[4]=(f-x)*q,t[5]=(1-(M+m))*q,t[6]=(b+d)*q,t[7]=0,t[8]=(l+p)*g,t[9]=(b-d)*g,t[10]=(1-(M+v))*g,t[11]=0,t[12]=a[0],t[13]=a[1],t[14]=a[2],t[15]=1,t},fromRotationTranslationScaleOrigin:function(t,n,a,r,u){var e=n[0],o=n[1],i=n[2],h=n[3],c=e+e,s=o+o,M=i+i,f=e*c,l=e*s,v=e*M,b=o*s,m=o*M,d=i*M,p=h*c,x=h*s,y=h*M,q=r[0],g=r[1],_=r[2],A=u[0],w=u[1],z=u[2],R=(1-(b+d))*q,O=(l+y)*q,j=(v-x)*q,E=(l-y)*g,P=(1-(f+d))*g,T=(m+p)*g,S=(v+x)*_,D=(m-p)*_,F=(1-(f+b))*_;return t[0]=R,t[1]=O,t[2]=j,t[3]=0,t[4]=E,t[5]=P,t[6]=T,t[7]=0,t[8]=S,t[9]=D,t[10]=F,t[11]=0,t[12]=a[0]+A-(R*A+E*w+S*z),t[13]=a[1]+w-(O*A+P*w+D*z),t[14]=a[2]+z-(j*A+T*w+F*z),t[15]=1,t},fromQuat:function(t,n){var a=n[0],r=n[1],u=n[2],e=n[3],o=a+a,i=r+r,h=u+u,c=a*o,s=r*o,M=r*i,f=u*o,l=u*i,v=u*h,b=e*o,m=e*i,d=e*h;return t[0]=1-M-v,t[1]=s+d,t[2]=f-m,t[3]=0,t[4]=s-d,t[5]=1-c-v,t[6]=l+b,t[7]=0,t[8]=f+m,t[9]=l-b,t[10]=1-c-M,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,t},frustum:function(t,n,a,r,u,e,o){var i=1/(a-n),h=1/(u-r),c=1/(e-o);return t[0]=2*e*i,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=2*e*h,t[6]=0,t[7]=0,t[8]=(a+n)*i,t[9]=(u+r)*h,t[10]=(o+e)*c,t[11]=-1,t[12]=0,t[13]=0,t[14]=o*e*2*c,t[15]=0,t},perspectiveNO:j,perspective:E,perspectiveZO:function(t,n,a,r,u){var e=1/Math.tan(n/2);if(t[0]=e/a,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=e,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[11]=-1,t[12]=0,t[13]=0,t[15]=0,null!=u&&u!==1/0){var o=1/(r-u);t[10]=u*o,t[14]=u*r*o;}else t[10]=-1,t[14]=-r;return t},perspectiveFromFieldOfView:function(t,n,a,r){var u=Math.tan(n.upDegrees*Math.PI/180),e=Math.tan(n.downDegrees*Math.PI/180),o=Math.tan(n.leftDegrees*Math.PI/180),i=Math.tan(n.rightDegrees*Math.PI/180),h=2/(o+i),c=2/(u+e);return t[0]=h,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=c,t[6]=0,t[7]=0,t[8]=-(o-i)*h*.5,t[9]=(u-e)*c*.5,t[10]=r/(a-r),t[11]=-1,t[12]=0,t[13]=0,t[14]=r*a/(a-r),t[15]=0,t},orthoNO:P,ortho:T,orthoZO:function(t,n,a,r,u,e,o){var i=1/(n-a),h=1/(r-u),c=1/(e-o);return t[0]=-2*i,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=-2*h,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[10]=c,t[11]=0,t[12]=(n+a)*i,t[13]=(u+r)*h,t[14]=e*c,t[15]=1,t},lookAt:function(t,a,r,u){var e,o,i,h,c,s,M,f,l,v,b=a[0],m=a[1],d=a[2],p=u[0],x=u[1],y=u[2],q=r[0],g=r[1],A=r[2];return Math.abs(b-q)<n&&Math.abs(m-g)<n&&Math.abs(d-A)<n?_(t):(M=b-q,f=m-g,l=d-A,e=x*(l*=v=1/Math.hypot(M,f,l))-y*(f*=v),o=y*(M*=v)-p*l,i=p*f-x*M,(v=Math.hypot(e,o,i))?(e*=v=1/v,o*=v,i*=v):(e=0,o=0,i=0),h=f*i-l*o,c=l*e-M*i,s=M*o-f*e,(v=Math.hypot(h,c,s))?(h*=v=1/v,c*=v,s*=v):(h=0,c=0,s=0),t[0]=e,t[1]=h,t[2]=M,t[3]=0,t[4]=o,t[5]=c,t[6]=f,t[7]=0,t[8]=i,t[9]=s,t[10]=l,t[11]=0,t[12]=-(e*b+o*m+i*d),t[13]=-(h*b+c*m+s*d),t[14]=-(M*b+f*m+l*d),t[15]=1,t)},targetTo:function(t,n,a,r){var u=n[0],e=n[1],o=n[2],i=r[0],h=r[1],c=r[2],s=u-a[0],M=e-a[1],f=o-a[2],l=s*s+M*M+f*f;l>0&&(s*=l=1/Math.sqrt(l),M*=l,f*=l);var v=h*f-c*M,b=c*s-i*f,m=i*M-h*s;return (l=v*v+b*b+m*m)>0&&(v*=l=1/Math.sqrt(l),b*=l,m*=l),t[0]=v,t[1]=b,t[2]=m,t[3]=0,t[4]=M*m-f*b,t[5]=f*v-s*m,t[6]=s*b-M*v,t[7]=0,t[8]=s,t[9]=M,t[10]=f,t[11]=0,t[12]=u,t[13]=e,t[14]=o,t[15]=1,t},str:function(t){return "mat4("+t[0]+", "+t[1]+", "+t[2]+", "+t[3]+", "+t[4]+", "+t[5]+", "+t[6]+", "+t[7]+", "+t[8]+", "+t[9]+", "+t[10]+", "+t[11]+", "+t[12]+", "+t[13]+", "+t[14]+", "+t[15]+")"},frob:function(t){return Math.hypot(t[0],t[1],t[2],t[3],t[4],t[5],t[6],t[7],t[8],t[9],t[10],t[11],t[12],t[13],t[14],t[15])},add:function(t,n,a){return t[0]=n[0]+a[0],t[1]=n[1]+a[1],t[2]=n[2]+a[2],t[3]=n[3]+a[3],t[4]=n[4]+a[4],t[5]=n[5]+a[5],t[6]=n[6]+a[6],t[7]=n[7]+a[7],t[8]=n[8]+a[8],t[9]=n[9]+a[9],t[10]=n[10]+a[10],t[11]=n[11]+a[11],t[12]=n[12]+a[12],t[13]=n[13]+a[13],t[14]=n[14]+a[14],t[15]=n[15]+a[15],t},subtract:S,multiplyScalar:function(t,n,a){return t[0]=n[0]*a,t[1]=n[1]*a,t[2]=n[2]*a,t[3]=n[3]*a,t[4]=n[4]*a,t[5]=n[5]*a,t[6]=n[6]*a,t[7]=n[7]*a,t[8]=n[8]*a,t[9]=n[9]*a,t[10]=n[10]*a,t[11]=n[11]*a,t[12]=n[12]*a,t[13]=n[13]*a,t[14]=n[14]*a,t[15]=n[15]*a,t},multiplyScalarAndAdd:function(t,n,a,r){return t[0]=n[0]+a[0]*r,t[1]=n[1]+a[1]*r,t[2]=n[2]+a[2]*r,t[3]=n[3]+a[3]*r,t[4]=n[4]+a[4]*r,t[5]=n[5]+a[5]*r,t[6]=n[6]+a[6]*r,t[7]=n[7]+a[7]*r,t[8]=n[8]+a[8]*r,t[9]=n[9]+a[9]*r,t[10]=n[10]+a[10]*r,t[11]=n[11]+a[11]*r,t[12]=n[12]+a[12]*r,t[13]=n[13]+a[13]*r,t[14]=n[14]+a[14]*r,t[15]=n[15]+a[15]*r,t},exactEquals:function(t,n){return t[0]===n[0]&&t[1]===n[1]&&t[2]===n[2]&&t[3]===n[3]&&t[4]===n[4]&&t[5]===n[5]&&t[6]===n[6]&&t[7]===n[7]&&t[8]===n[8]&&t[9]===n[9]&&t[10]===n[10]&&t[11]===n[11]&&t[12]===n[12]&&t[13]===n[13]&&t[14]===n[14]&&t[15]===n[15]},equals:function(t,a){var r=t[0],u=t[1],e=t[2],o=t[3],i=t[4],h=t[5],c=t[6],s=t[7],M=t[8],f=t[9],l=t[10],v=t[11],b=t[12],m=t[13],d=t[14],p=t[15],x=a[0],y=a[1],q=a[2],g=a[3],_=a[4],A=a[5],w=a[6],z=a[7],R=a[8],O=a[9],j=a[10],E=a[11],P=a[12],T=a[13],S=a[14],D=a[15];return Math.abs(r-x)<=n*Math.max(1,Math.abs(r),Math.abs(x))&&Math.abs(u-y)<=n*Math.max(1,Math.abs(u),Math.abs(y))&&Math.abs(e-q)<=n*Math.max(1,Math.abs(e),Math.abs(q))&&Math.abs(o-g)<=n*Math.max(1,Math.abs(o),Math.abs(g))&&Math.abs(i-_)<=n*Math.max(1,Math.abs(i),Math.abs(_))&&Math.abs(h-A)<=n*Math.max(1,Math.abs(h),Math.abs(A))&&Math.abs(c-w)<=n*Math.max(1,Math.abs(c),Math.abs(w))&&Math.abs(s-z)<=n*Math.max(1,Math.abs(s),Math.abs(z))&&Math.abs(M-R)<=n*Math.max(1,Math.abs(M),Math.abs(R))&&Math.abs(f-O)<=n*Math.max(1,Math.abs(f),Math.abs(O))&&Math.abs(l-j)<=n*Math.max(1,Math.abs(l),Math.abs(j))&&Math.abs(v-E)<=n*Math.max(1,Math.abs(v),Math.abs(E))&&Math.abs(b-P)<=n*Math.max(1,Math.abs(b),Math.abs(P))&&Math.abs(m-T)<=n*Math.max(1,Math.abs(m),Math.abs(T))&&Math.abs(d-S)<=n*Math.max(1,Math.abs(d),Math.abs(S))&&Math.abs(p-D)<=n*Math.max(1,Math.abs(p),Math.abs(D))},mul:D,sub:F});function L(){var t=new a(3);return a!=Float32Array&&(t[0]=0,t[1]=0,t[2]=0),t}function V(t){var n=t[0],a=t[1],r=t[2];return Math.hypot(n,a,r)}function k(t,n,r){var u=new a(3);return u[0]=t,u[1]=n,u[2]=r,u}function Q(t,n,a){return t[0]=n[0]-a[0],t[1]=n[1]-a[1],t[2]=n[2]-a[2],t}function Y(t,n,a){return t[0]=n[0]*a[0],t[1]=n[1]*a[1],t[2]=n[2]*a[2],t}function Z(t,n,a){return t[0]=n[0]/a[0],t[1]=n[1]/a[1],t[2]=n[2]/a[2],t}function N(t,n){var a=n[0]-t[0],r=n[1]-t[1],u=n[2]-t[2];return Math.hypot(a,r,u)}function X(t,n){var a=n[0]-t[0],r=n[1]-t[1],u=n[2]-t[2];return a*a+r*r+u*u}function B(t){var n=t[0],a=t[1],r=t[2];return n*n+a*a+r*r}function U(t,n){var a=n[0],r=n[1],u=n[2],e=a*a+r*r+u*u;return e>0&&(e=1/Math.sqrt(e)),t[0]=n[0]*e,t[1]=n[1]*e,t[2]=n[2]*e,t}function G(t,n){return t[0]*n[0]+t[1]*n[1]+t[2]*n[2]}function W(t,n,a){var r=n[0],u=n[1],e=n[2],o=a[0],i=a[1],h=a[2];return t[0]=u*h-e*i,t[1]=e*o-r*h,t[2]=r*i-u*o,t}var C,H=Q,J=Y,K=Z,$=N,tt=X,nt=V,at=B,rt=(C=L(),function(t,n,a,r,u,e){var o,i;for(n||(n=3),a||(a=0),i=r?Math.min(r*n+a,t.length):t.length,o=a;o<i;o+=n)C[0]=t[o],C[1]=t[o+1],C[2]=t[o+2],u(C,C,e),t[o]=C[0],t[o+1]=C[1],t[o+2]=C[2];return t}),ut=Object.freeze({__proto__:null,create:L,clone:function(t){var n=new a(3);return n[0]=t[0],n[1]=t[1],n[2]=t[2],n},length:V,fromValues:k,copy:function(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t},set:function(t,n,a,r){return t[0]=n,t[1]=a,t[2]=r,t},add:function(t,n,a){return t[0]=n[0]+a[0],t[1]=n[1]+a[1],t[2]=n[2]+a[2],t},subtract:Q,multiply:Y,divide:Z,ceil:function(t,n){return t[0]=Math.ceil(n[0]),t[1]=Math.ceil(n[1]),t[2]=Math.ceil(n[2]),t},floor:function(t,n){return t[0]=Math.floor(n[0]),t[1]=Math.floor(n[1]),t[2]=Math.floor(n[2]),t},min:function(t,n,a){return t[0]=Math.min(n[0],a[0]),t[1]=Math.min(n[1],a[1]),t[2]=Math.min(n[2],a[2]),t},max:function(t,n,a){return t[0]=Math.max(n[0],a[0]),t[1]=Math.max(n[1],a[1]),t[2]=Math.max(n[2],a[2]),t},round:function(t,n){return t[0]=Math.round(n[0]),t[1]=Math.round(n[1]),t[2]=Math.round(n[2]),t},scale:function(t,n,a){return t[0]=n[0]*a,t[1]=n[1]*a,t[2]=n[2]*a,t},scaleAndAdd:function(t,n,a,r){return t[0]=n[0]+a[0]*r,t[1]=n[1]+a[1]*r,t[2]=n[2]+a[2]*r,t},distance:N,squaredDistance:X,squaredLength:B,negate:function(t,n){return t[0]=-n[0],t[1]=-n[1],t[2]=-n[2],t},inverse:function(t,n){return t[0]=1/n[0],t[1]=1/n[1],t[2]=1/n[2],t},normalize:U,dot:G,cross:W,lerp:function(t,n,a,r){var u=n[0],e=n[1],o=n[2];return t[0]=u+r*(a[0]-u),t[1]=e+r*(a[1]-e),t[2]=o+r*(a[2]-o),t},slerp:function(t,n,a,r){var u=Math.acos(Math.min(Math.max(G(n,a),-1),1)),e=Math.sin(u),o=Math.sin((1-r)*u)/e,i=Math.sin(r*u)/e;return t[0]=o*n[0]+i*a[0],t[1]=o*n[1]+i*a[1],t[2]=o*n[2]+i*a[2],t},hermite:function(t,n,a,r,u,e){var o=e*e,i=o*(2*e-3)+1,h=o*(e-2)+e,c=o*(e-1),s=o*(3-2*e);return t[0]=n[0]*i+a[0]*h+r[0]*c+u[0]*s,t[1]=n[1]*i+a[1]*h+r[1]*c+u[1]*s,t[2]=n[2]*i+a[2]*h+r[2]*c+u[2]*s,t},bezier:function(t,n,a,r,u,e){var o=1-e,i=o*o,h=e*e,c=i*o,s=3*e*i,M=3*h*o,f=h*e;return t[0]=n[0]*c+a[0]*s+r[0]*M+u[0]*f,t[1]=n[1]*c+a[1]*s+r[1]*M+u[1]*f,t[2]=n[2]*c+a[2]*s+r[2]*M+u[2]*f,t},random:function(t,n){n=n||1;var a=2*r()*Math.PI,u=2*r()-1,e=Math.sqrt(1-u*u)*n;return t[0]=Math.cos(a)*e,t[1]=Math.sin(a)*e,t[2]=u*n,t},transformMat4:function(t,n,a){var r=n[0],u=n[1],e=n[2],o=a[3]*r+a[7]*u+a[11]*e+a[15];return o=o||1,t[0]=(a[0]*r+a[4]*u+a[8]*e+a[12])/o,t[1]=(a[1]*r+a[5]*u+a[9]*e+a[13])/o,t[2]=(a[2]*r+a[6]*u+a[10]*e+a[14])/o,t},transformMat3:function(t,n,a){var r=n[0],u=n[1],e=n[2];return t[0]=r*a[0]+u*a[3]+e*a[6],t[1]=r*a[1]+u*a[4]+e*a[7],t[2]=r*a[2]+u*a[5]+e*a[8],t},transformQuat:function(t,n,a){var r=a[0],u=a[1],e=a[2],o=a[3],i=n[0],h=n[1],c=n[2],s=u*c-e*h,M=e*i-r*c,f=r*h-u*i,l=u*f-e*M,v=e*s-r*f,b=r*M-u*s,m=2*o;return s*=m,M*=m,f*=m,l*=2,v*=2,b*=2,t[0]=i+s+l,t[1]=h+M+v,t[2]=c+f+b,t},rotateX:function(t,n,a,r){var u=[],e=[];return u[0]=n[0]-a[0],u[1]=n[1]-a[1],u[2]=n[2]-a[2],e[0]=u[0],e[1]=u[1]*Math.cos(r)-u[2]*Math.sin(r),e[2]=u[1]*Math.sin(r)+u[2]*Math.cos(r),t[0]=e[0]+a[0],t[1]=e[1]+a[1],t[2]=e[2]+a[2],t},rotateY:function(t,n,a,r){var u=[],e=[];return u[0]=n[0]-a[0],u[1]=n[1]-a[1],u[2]=n[2]-a[2],e[0]=u[2]*Math.sin(r)+u[0]*Math.cos(r),e[1]=u[1],e[2]=u[2]*Math.cos(r)-u[0]*Math.sin(r),t[0]=e[0]+a[0],t[1]=e[1]+a[1],t[2]=e[2]+a[2],t},rotateZ:function(t,n,a,r){var u=[],e=[];return u[0]=n[0]-a[0],u[1]=n[1]-a[1],u[2]=n[2]-a[2],e[0]=u[0]*Math.cos(r)-u[1]*Math.sin(r),e[1]=u[0]*Math.sin(r)+u[1]*Math.cos(r),e[2]=u[2],t[0]=e[0]+a[0],t[1]=e[1]+a[1],t[2]=e[2]+a[2],t},angle:function(t,n){var a=t[0],r=t[1],u=t[2],e=n[0],o=n[1],i=n[2],h=Math.sqrt((a*a+r*r+u*u)*(e*e+o*o+i*i)),c=h&&G(t,n)/h;return Math.acos(Math.min(Math.max(c,-1),1))},zero:function(t){return t[0]=0,t[1]=0,t[2]=0,t},str:function(t){return "vec3("+t[0]+", "+t[1]+", "+t[2]+")"},exactEquals:function(t,n){return t[0]===n[0]&&t[1]===n[1]&&t[2]===n[2]},equals:function(t,a){var r=t[0],u=t[1],e=t[2],o=a[0],i=a[1],h=a[2];return Math.abs(r-o)<=n*Math.max(1,Math.abs(r),Math.abs(o))&&Math.abs(u-i)<=n*Math.max(1,Math.abs(u),Math.abs(i))&&Math.abs(e-h)<=n*Math.max(1,Math.abs(e),Math.abs(h))},sub:H,mul:J,div:K,dist:$,sqrDist:tt,len:nt,sqrLen:at,forEach:rt});function et(){var t=new a(4);return a!=Float32Array&&(t[0]=0,t[1]=0,t[2]=0,t[3]=0),t}function ot(t){var n=new a(4);return n[0]=t[0],n[1]=t[1],n[2]=t[2],n[3]=t[3],n}function it(t,n,r,u){var e=new a(4);return e[0]=t,e[1]=n,e[2]=r,e[3]=u,e}function ht(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t}function ct(t,n,a,r,u){return t[0]=n,t[1]=a,t[2]=r,t[3]=u,t}function st(t,n,a){return t[0]=n[0]+a[0],t[1]=n[1]+a[1],t[2]=n[2]+a[2],t[3]=n[3]+a[3],t}function Mt(t,n,a){return t[0]=n[0]-a[0],t[1]=n[1]-a[1],t[2]=n[2]-a[2],t[3]=n[3]-a[3],t}function ft(t,n,a){return t[0]=n[0]*a[0],t[1]=n[1]*a[1],t[2]=n[2]*a[2],t[3]=n[3]*a[3],t}function lt(t,n,a){return t[0]=n[0]/a[0],t[1]=n[1]/a[1],t[2]=n[2]/a[2],t[3]=n[3]/a[3],t}function vt(t,n,a){return t[0]=n[0]*a,t[1]=n[1]*a,t[2]=n[2]*a,t[3]=n[3]*a,t}function bt(t,n){var a=n[0]-t[0],r=n[1]-t[1],u=n[2]-t[2],e=n[3]-t[3];return Math.hypot(a,r,u,e)}function mt(t,n){var a=n[0]-t[0],r=n[1]-t[1],u=n[2]-t[2],e=n[3]-t[3];return a*a+r*r+u*u+e*e}function dt(t){var n=t[0],a=t[1],r=t[2],u=t[3];return Math.hypot(n,a,r,u)}function pt(t){var n=t[0],a=t[1],r=t[2],u=t[3];return n*n+a*a+r*r+u*u}function xt(t,n){var a=n[0],r=n[1],u=n[2],e=n[3],o=a*a+r*r+u*u+e*e;return o>0&&(o=1/Math.sqrt(o)),t[0]=a*o,t[1]=r*o,t[2]=u*o,t[3]=e*o,t}function yt(t,n){return t[0]*n[0]+t[1]*n[1]+t[2]*n[2]+t[3]*n[3]}function qt(t,n,a,r){var u=n[0],e=n[1],o=n[2],i=n[3];return t[0]=u+r*(a[0]-u),t[1]=e+r*(a[1]-e),t[2]=o+r*(a[2]-o),t[3]=i+r*(a[3]-i),t}function gt(t,n){return t[0]===n[0]&&t[1]===n[1]&&t[2]===n[2]&&t[3]===n[3]}var _t=Mt,At=ft,wt=lt,zt=bt,Rt=mt,Ot=dt,jt=pt,Et=function(){var t=et();return function(n,a,r,u,e,o){var i,h;for(a||(a=4),r||(r=0),h=u?Math.min(u*a+r,n.length):n.length,i=r;i<h;i+=a)t[0]=n[i],t[1]=n[i+1],t[2]=n[i+2],t[3]=n[i+3],e(t,t,o),n[i]=t[0],n[i+1]=t[1],n[i+2]=t[2],n[i+3]=t[3];return n}}(),Pt=Object.freeze({__proto__:null,create:et,clone:ot,fromValues:it,copy:ht,set:ct,add:st,subtract:Mt,multiply:ft,divide:lt,ceil:function(t,n){return t[0]=Math.ceil(n[0]),t[1]=Math.ceil(n[1]),t[2]=Math.ceil(n[2]),t[3]=Math.ceil(n[3]),t},floor:function(t,n){return t[0]=Math.floor(n[0]),t[1]=Math.floor(n[1]),t[2]=Math.floor(n[2]),t[3]=Math.floor(n[3]),t},min:function(t,n,a){return t[0]=Math.min(n[0],a[0]),t[1]=Math.min(n[1],a[1]),t[2]=Math.min(n[2],a[2]),t[3]=Math.min(n[3],a[3]),t},max:function(t,n,a){return t[0]=Math.max(n[0],a[0]),t[1]=Math.max(n[1],a[1]),t[2]=Math.max(n[2],a[2]),t[3]=Math.max(n[3],a[3]),t},round:function(t,n){return t[0]=Math.round(n[0]),t[1]=Math.round(n[1]),t[2]=Math.round(n[2]),t[3]=Math.round(n[3]),t},scale:vt,scaleAndAdd:function(t,n,a,r){return t[0]=n[0]+a[0]*r,t[1]=n[1]+a[1]*r,t[2]=n[2]+a[2]*r,t[3]=n[3]+a[3]*r,t},distance:bt,squaredDistance:mt,length:dt,squaredLength:pt,negate:function(t,n){return t[0]=-n[0],t[1]=-n[1],t[2]=-n[2],t[3]=-n[3],t},inverse:function(t,n){return t[0]=1/n[0],t[1]=1/n[1],t[2]=1/n[2],t[3]=1/n[3],t},normalize:xt,dot:yt,cross:function(t,n,a,r){var u=a[0]*r[1]-a[1]*r[0],e=a[0]*r[2]-a[2]*r[0],o=a[0]*r[3]-a[3]*r[0],i=a[1]*r[2]-a[2]*r[1],h=a[1]*r[3]-a[3]*r[1],c=a[2]*r[3]-a[3]*r[2],s=n[0],M=n[1],f=n[2],l=n[3];return t[0]=M*c-f*h+l*i,t[1]=-s*c+f*o-l*e,t[2]=s*h-M*o+l*u,t[3]=-s*i+M*e-f*u,t},lerp:qt,random:function(t,n){var a,u,e,o,i,h;n=n||1;do{i=(a=2*r()-1)*a+(u=2*r()-1)*u;}while(i>=1);do{h=(e=2*r()-1)*e+(o=2*r()-1)*o;}while(h>=1);var c=Math.sqrt((1-i)/h);return t[0]=n*a,t[1]=n*u,t[2]=n*e*c,t[3]=n*o*c,t},transformMat4:function(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3];return t[0]=a[0]*r+a[4]*u+a[8]*e+a[12]*o,t[1]=a[1]*r+a[5]*u+a[9]*e+a[13]*o,t[2]=a[2]*r+a[6]*u+a[10]*e+a[14]*o,t[3]=a[3]*r+a[7]*u+a[11]*e+a[15]*o,t},transformQuat:function(t,n,a){var r=n[0],u=n[1],e=n[2],o=a[0],i=a[1],h=a[2],c=a[3],s=c*r+i*e-h*u,M=c*u+h*r-o*e,f=c*e+o*u-i*r,l=-o*r-i*u-h*e;return t[0]=s*c+l*-o+M*-h-f*-i,t[1]=M*c+l*-i+f*-o-s*-h,t[2]=f*c+l*-h+s*-i-M*-o,t[3]=n[3],t},zero:function(t){return t[0]=0,t[1]=0,t[2]=0,t[3]=0,t},str:function(t){return "vec4("+t[0]+", "+t[1]+", "+t[2]+", "+t[3]+")"},exactEquals:gt,equals:function(t,a){var r=t[0],u=t[1],e=t[2],o=t[3],i=a[0],h=a[1],c=a[2],s=a[3];return Math.abs(r-i)<=n*Math.max(1,Math.abs(r),Math.abs(i))&&Math.abs(u-h)<=n*Math.max(1,Math.abs(u),Math.abs(h))&&Math.abs(e-c)<=n*Math.max(1,Math.abs(e),Math.abs(c))&&Math.abs(o-s)<=n*Math.max(1,Math.abs(o),Math.abs(s))},sub:_t,mul:At,div:wt,dist:zt,sqrDist:Rt,len:Ot,sqrLen:jt,forEach:Et});function Tt(){var t=new a(4);return a!=Float32Array&&(t[0]=0,t[1]=0,t[2]=0),t[3]=1,t}function St(t,n,a){a*=.5;var r=Math.sin(a);return t[0]=r*n[0],t[1]=r*n[1],t[2]=r*n[2],t[3]=Math.cos(a),t}function Dt(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=a[0],h=a[1],c=a[2],s=a[3];return t[0]=r*s+o*i+u*c-e*h,t[1]=u*s+o*h+e*i-r*c,t[2]=e*s+o*c+r*h-u*i,t[3]=o*s-r*i-u*h-e*c,t}function Ft(t,n,a){a*=.5;var r=n[0],u=n[1],e=n[2],o=n[3],i=Math.sin(a),h=Math.cos(a);return t[0]=r*h+o*i,t[1]=u*h+e*i,t[2]=e*h-u*i,t[3]=o*h-r*i,t}function It(t,n,a){a*=.5;var r=n[0],u=n[1],e=n[2],o=n[3],i=Math.sin(a),h=Math.cos(a);return t[0]=r*h-e*i,t[1]=u*h+o*i,t[2]=e*h+r*i,t[3]=o*h-u*i,t}function Lt(t,n,a){a*=.5;var r=n[0],u=n[1],e=n[2],o=n[3],i=Math.sin(a),h=Math.cos(a);return t[0]=r*h+u*i,t[1]=u*h-r*i,t[2]=e*h+o*i,t[3]=o*h-e*i,t}function Vt(t,n){var a=n[0],r=n[1],u=n[2],e=n[3],o=Math.sqrt(a*a+r*r+u*u),i=Math.exp(e),h=o>0?i*Math.sin(o)/o:0;return t[0]=a*h,t[1]=r*h,t[2]=u*h,t[3]=i*Math.cos(o),t}function kt(t,n){var a=n[0],r=n[1],u=n[2],e=n[3],o=Math.sqrt(a*a+r*r+u*u),i=o>0?Math.atan2(o,e)/o:0;return t[0]=a*i,t[1]=r*i,t[2]=u*i,t[3]=.5*Math.log(a*a+r*r+u*u+e*e),t}function Qt(t,a,r,u){var e,o,i,h,c,s=a[0],M=a[1],f=a[2],l=a[3],v=r[0],b=r[1],m=r[2],d=r[3];return (o=s*v+M*b+f*m+l*d)<0&&(o=-o,v=-v,b=-b,m=-m,d=-d),1-o>n?(e=Math.acos(o),i=Math.sin(e),h=Math.sin((1-u)*e)/i,c=Math.sin(u*e)/i):(h=1-u,c=u),t[0]=h*s+c*v,t[1]=h*M+c*b,t[2]=h*f+c*m,t[3]=h*l+c*d,t}function Yt(t,n){var a,r=n[0]+n[4]+n[8];if(r>0)a=Math.sqrt(r+1),t[3]=.5*a,a=.5/a,t[0]=(n[5]-n[7])*a,t[1]=(n[6]-n[2])*a,t[2]=(n[1]-n[3])*a;else {var u=0;n[4]>n[0]&&(u=1),n[8]>n[3*u+u]&&(u=2);var e=(u+1)%3,o=(u+2)%3;a=Math.sqrt(n[3*u+u]-n[3*e+e]-n[3*o+o]+1),t[u]=.5*a,a=.5/a,t[3]=(n[3*e+o]-n[3*o+e])*a,t[e]=(n[3*e+u]+n[3*u+e])*a,t[o]=(n[3*o+u]+n[3*u+o])*a;}return t}var Zt=ot,Nt=it,Xt=ht,Bt=ct,Ut=st,Gt=Dt,Wt=vt,Ct=yt,Ht=qt,Jt=dt,Kt=Jt,$t=pt,tn=$t,nn=xt,an=gt;var rn,un,en,on,hn,cn,sn=(rn=L(),un=k(1,0,0),en=k(0,1,0),function(t,n,a){var r=G(n,a);return r<-.999999?(W(rn,un,n),nt(rn)<1e-6&&W(rn,en,n),U(rn,rn),St(t,rn,Math.PI),t):r>.999999?(t[0]=0,t[1]=0,t[2]=0,t[3]=1,t):(W(rn,n,a),t[0]=rn[0],t[1]=rn[1],t[2]=rn[2],t[3]=1+r,nn(t,t))}),Mn=(on=Tt(),hn=Tt(),function(t,n,a,r,u,e){return Qt(on,n,u,e),Qt(hn,a,r,e),Qt(t,on,hn,2*e*(1-e)),t}),fn=(cn=d(),function(t,n,a,r){return cn[0]=a[0],cn[3]=a[1],cn[6]=a[2],cn[1]=r[0],cn[4]=r[1],cn[7]=r[2],cn[2]=-n[0],cn[5]=-n[1],cn[8]=-n[2],nn(t,Yt(t,cn))}),ln=Object.freeze({__proto__:null,create:Tt,identity:function(t){return t[0]=0,t[1]=0,t[2]=0,t[3]=1,t},setAxisAngle:St,getAxisAngle:function(t,a){var r=2*Math.acos(a[3]),u=Math.sin(r/2);return u>n?(t[0]=a[0]/u,t[1]=a[1]/u,t[2]=a[2]/u):(t[0]=1,t[1]=0,t[2]=0),r},getAngle:function(t,n){var a=Ct(t,n);return Math.acos(2*a*a-1)},multiply:Dt,rotateX:Ft,rotateY:It,rotateZ:Lt,calculateW:function(t,n){var a=n[0],r=n[1],u=n[2];return t[0]=a,t[1]=r,t[2]=u,t[3]=Math.sqrt(Math.abs(1-a*a-r*r-u*u)),t},exp:Vt,ln:kt,pow:function(t,n,a){return kt(t,n),Wt(t,t,a),Vt(t,t),t},slerp:Qt,random:function(t){var n=r(),a=r(),u=r(),e=Math.sqrt(1-n),o=Math.sqrt(n);return t[0]=e*Math.sin(2*Math.PI*a),t[1]=e*Math.cos(2*Math.PI*a),t[2]=o*Math.sin(2*Math.PI*u),t[3]=o*Math.cos(2*Math.PI*u),t},invert:function(t,n){var a=n[0],r=n[1],u=n[2],e=n[3],o=a*a+r*r+u*u+e*e,i=o?1/o:0;return t[0]=-a*i,t[1]=-r*i,t[2]=-u*i,t[3]=e*i,t},conjugate:function(t,n){return t[0]=-n[0],t[1]=-n[1],t[2]=-n[2],t[3]=n[3],t},fromMat3:Yt,fromEuler:function(t,n,a,r){var e=arguments.length>4&&void 0!==arguments[4]?arguments[4]:u,o=Math.PI/360;n*=o,r*=o,a*=o;var i=Math.sin(n),h=Math.cos(n),c=Math.sin(a),s=Math.cos(a),M=Math.sin(r),f=Math.cos(r);switch(e){case"xyz":t[0]=i*s*f+h*c*M,t[1]=h*c*f-i*s*M,t[2]=h*s*M+i*c*f,t[3]=h*s*f-i*c*M;break;case"xzy":t[0]=i*s*f-h*c*M,t[1]=h*c*f-i*s*M,t[2]=h*s*M+i*c*f,t[3]=h*s*f+i*c*M;break;case"yxz":t[0]=i*s*f+h*c*M,t[1]=h*c*f-i*s*M,t[2]=h*s*M-i*c*f,t[3]=h*s*f+i*c*M;break;case"yzx":t[0]=i*s*f+h*c*M,t[1]=h*c*f+i*s*M,t[2]=h*s*M-i*c*f,t[3]=h*s*f-i*c*M;break;case"zxy":t[0]=i*s*f-h*c*M,t[1]=h*c*f+i*s*M,t[2]=h*s*M+i*c*f,t[3]=h*s*f-i*c*M;break;case"zyx":t[0]=i*s*f-h*c*M,t[1]=h*c*f+i*s*M,t[2]=h*s*M-i*c*f,t[3]=h*s*f+i*c*M;break;default:throw new Error("Unknown angle order "+e)}return t},str:function(t){return "quat("+t[0]+", "+t[1]+", "+t[2]+", "+t[3]+")"},clone:Zt,fromValues:Nt,copy:Xt,set:Bt,add:Ut,mul:Gt,scale:Wt,dot:Ct,lerp:Ht,length:Jt,len:Kt,squaredLength:$t,sqrLen:tn,normalize:nn,exactEquals:an,equals:function(t,n){return Math.abs(yt(t,n))>=.999999},rotationTo:sn,sqlerp:Mn,setAxes:fn});function vn(t,n,a){var r=.5*a[0],u=.5*a[1],e=.5*a[2],o=n[0],i=n[1],h=n[2],c=n[3];return t[0]=o,t[1]=i,t[2]=h,t[3]=c,t[4]=r*c+u*h-e*i,t[5]=u*c+e*o-r*h,t[6]=e*c+r*i-u*o,t[7]=-r*o-u*i-e*h,t}function bn(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t}var mn=Xt;var dn=Xt;function pn(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=a[4],h=a[5],c=a[6],s=a[7],M=n[4],f=n[5],l=n[6],v=n[7],b=a[0],m=a[1],d=a[2],p=a[3];return t[0]=r*p+o*b+u*d-e*m,t[1]=u*p+o*m+e*b-r*d,t[2]=e*p+o*d+r*m-u*b,t[3]=o*p-r*b-u*m-e*d,t[4]=r*s+o*i+u*c-e*h+M*p+v*b+f*d-l*m,t[5]=u*s+o*h+e*i-r*c+f*p+v*m+l*b-M*d,t[6]=e*s+o*c+r*h-u*i+l*p+v*d+M*m-f*b,t[7]=o*s-r*i-u*h-e*c+v*p-M*b-f*m-l*d,t}var xn=pn;var yn=Ct;var qn=Jt,gn=qn,_n=$t,An=_n;var wn=Object.freeze({__proto__:null,create:function(){var t=new a(8);return a!=Float32Array&&(t[0]=0,t[1]=0,t[2]=0,t[4]=0,t[5]=0,t[6]=0,t[7]=0),t[3]=1,t},clone:function(t){var n=new a(8);return n[0]=t[0],n[1]=t[1],n[2]=t[2],n[3]=t[3],n[4]=t[4],n[5]=t[5],n[6]=t[6],n[7]=t[7],n},fromValues:function(t,n,r,u,e,o,i,h){var c=new a(8);return c[0]=t,c[1]=n,c[2]=r,c[3]=u,c[4]=e,c[5]=o,c[6]=i,c[7]=h,c},fromRotationTranslationValues:function(t,n,r,u,e,o,i){var h=new a(8);h[0]=t,h[1]=n,h[2]=r,h[3]=u;var c=.5*e,s=.5*o,M=.5*i;return h[4]=c*u+s*r-M*n,h[5]=s*u+M*t-c*r,h[6]=M*u+c*n-s*t,h[7]=-c*t-s*n-M*r,h},fromRotationTranslation:vn,fromTranslation:function(t,n){return t[0]=0,t[1]=0,t[2]=0,t[3]=1,t[4]=.5*n[0],t[5]=.5*n[1],t[6]=.5*n[2],t[7]=0,t},fromRotation:function(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=0,t[5]=0,t[6]=0,t[7]=0,t},fromMat4:function(t,n){var r=Tt();O(r,n);var u=new a(3);return z(u,n),vn(t,r,u),t},copy:bn,identity:function(t){return t[0]=0,t[1]=0,t[2]=0,t[3]=1,t[4]=0,t[5]=0,t[6]=0,t[7]=0,t},set:function(t,n,a,r,u,e,o,i,h){return t[0]=n,t[1]=a,t[2]=r,t[3]=u,t[4]=e,t[5]=o,t[6]=i,t[7]=h,t},getReal:mn,getDual:function(t,n){return t[0]=n[4],t[1]=n[5],t[2]=n[6],t[3]=n[7],t},setReal:dn,setDual:function(t,n){return t[4]=n[0],t[5]=n[1],t[6]=n[2],t[7]=n[3],t},getTranslation:function(t,n){var a=n[4],r=n[5],u=n[6],e=n[7],o=-n[0],i=-n[1],h=-n[2],c=n[3];return t[0]=2*(a*c+e*o+r*h-u*i),t[1]=2*(r*c+e*i+u*o-a*h),t[2]=2*(u*c+e*h+a*i-r*o),t},translate:function(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=.5*a[0],h=.5*a[1],c=.5*a[2],s=n[4],M=n[5],f=n[6],l=n[7];return t[0]=r,t[1]=u,t[2]=e,t[3]=o,t[4]=o*i+u*c-e*h+s,t[5]=o*h+e*i-r*c+M,t[6]=o*c+r*h-u*i+f,t[7]=-r*i-u*h-e*c+l,t},rotateX:function(t,n,a){var r=-n[0],u=-n[1],e=-n[2],o=n[3],i=n[4],h=n[5],c=n[6],s=n[7],M=i*o+s*r+h*e-c*u,f=h*o+s*u+c*r-i*e,l=c*o+s*e+i*u-h*r,v=s*o-i*r-h*u-c*e;return Ft(t,n,a),r=t[0],u=t[1],e=t[2],o=t[3],t[4]=M*o+v*r+f*e-l*u,t[5]=f*o+v*u+l*r-M*e,t[6]=l*o+v*e+M*u-f*r,t[7]=v*o-M*r-f*u-l*e,t},rotateY:function(t,n,a){var r=-n[0],u=-n[1],e=-n[2],o=n[3],i=n[4],h=n[5],c=n[6],s=n[7],M=i*o+s*r+h*e-c*u,f=h*o+s*u+c*r-i*e,l=c*o+s*e+i*u-h*r,v=s*o-i*r-h*u-c*e;return It(t,n,a),r=t[0],u=t[1],e=t[2],o=t[3],t[4]=M*o+v*r+f*e-l*u,t[5]=f*o+v*u+l*r-M*e,t[6]=l*o+v*e+M*u-f*r,t[7]=v*o-M*r-f*u-l*e,t},rotateZ:function(t,n,a){var r=-n[0],u=-n[1],e=-n[2],o=n[3],i=n[4],h=n[5],c=n[6],s=n[7],M=i*o+s*r+h*e-c*u,f=h*o+s*u+c*r-i*e,l=c*o+s*e+i*u-h*r,v=s*o-i*r-h*u-c*e;return Lt(t,n,a),r=t[0],u=t[1],e=t[2],o=t[3],t[4]=M*o+v*r+f*e-l*u,t[5]=f*o+v*u+l*r-M*e,t[6]=l*o+v*e+M*u-f*r,t[7]=v*o-M*r-f*u-l*e,t},rotateByQuatAppend:function(t,n,a){var r=a[0],u=a[1],e=a[2],o=a[3],i=n[0],h=n[1],c=n[2],s=n[3];return t[0]=i*o+s*r+h*e-c*u,t[1]=h*o+s*u+c*r-i*e,t[2]=c*o+s*e+i*u-h*r,t[3]=s*o-i*r-h*u-c*e,i=n[4],h=n[5],c=n[6],s=n[7],t[4]=i*o+s*r+h*e-c*u,t[5]=h*o+s*u+c*r-i*e,t[6]=c*o+s*e+i*u-h*r,t[7]=s*o-i*r-h*u-c*e,t},rotateByQuatPrepend:function(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=a[0],h=a[1],c=a[2],s=a[3];return t[0]=r*s+o*i+u*c-e*h,t[1]=u*s+o*h+e*i-r*c,t[2]=e*s+o*c+r*h-u*i,t[3]=o*s-r*i-u*h-e*c,i=a[4],h=a[5],c=a[6],s=a[7],t[4]=r*s+o*i+u*c-e*h,t[5]=u*s+o*h+e*i-r*c,t[6]=e*s+o*c+r*h-u*i,t[7]=o*s-r*i-u*h-e*c,t},rotateAroundAxis:function(t,a,r,u){if(Math.abs(u)<n)return bn(t,a);var e=Math.hypot(r[0],r[1],r[2]);u*=.5;var o=Math.sin(u),i=o*r[0]/e,h=o*r[1]/e,c=o*r[2]/e,s=Math.cos(u),M=a[0],f=a[1],l=a[2],v=a[3];t[0]=M*s+v*i+f*c-l*h,t[1]=f*s+v*h+l*i-M*c,t[2]=l*s+v*c+M*h-f*i,t[3]=v*s-M*i-f*h-l*c;var b=a[4],m=a[5],d=a[6],p=a[7];return t[4]=b*s+p*i+m*c-d*h,t[5]=m*s+p*h+d*i-b*c,t[6]=d*s+p*c+b*h-m*i,t[7]=p*s-b*i-m*h-d*c,t},add:function(t,n,a){return t[0]=n[0]+a[0],t[1]=n[1]+a[1],t[2]=n[2]+a[2],t[3]=n[3]+a[3],t[4]=n[4]+a[4],t[5]=n[5]+a[5],t[6]=n[6]+a[6],t[7]=n[7]+a[7],t},multiply:pn,mul:xn,scale:function(t,n,a){return t[0]=n[0]*a,t[1]=n[1]*a,t[2]=n[2]*a,t[3]=n[3]*a,t[4]=n[4]*a,t[5]=n[5]*a,t[6]=n[6]*a,t[7]=n[7]*a,t},dot:yn,lerp:function(t,n,a,r){var u=1-r;return yn(n,a)<0&&(r=-r),t[0]=n[0]*u+a[0]*r,t[1]=n[1]*u+a[1]*r,t[2]=n[2]*u+a[2]*r,t[3]=n[3]*u+a[3]*r,t[4]=n[4]*u+a[4]*r,t[5]=n[5]*u+a[5]*r,t[6]=n[6]*u+a[6]*r,t[7]=n[7]*u+a[7]*r,t},invert:function(t,n){var a=_n(n);return t[0]=-n[0]/a,t[1]=-n[1]/a,t[2]=-n[2]/a,t[3]=n[3]/a,t[4]=-n[4]/a,t[5]=-n[5]/a,t[6]=-n[6]/a,t[7]=n[7]/a,t},conjugate:function(t,n){return t[0]=-n[0],t[1]=-n[1],t[2]=-n[2],t[3]=n[3],t[4]=-n[4],t[5]=-n[5],t[6]=-n[6],t[7]=n[7],t},length:qn,len:gn,squaredLength:_n,sqrLen:An,normalize:function(t,n){var a=_n(n);if(a>0){a=Math.sqrt(a);var r=n[0]/a,u=n[1]/a,e=n[2]/a,o=n[3]/a,i=n[4],h=n[5],c=n[6],s=n[7],M=r*i+u*h+e*c+o*s;t[0]=r,t[1]=u,t[2]=e,t[3]=o,t[4]=(i-r*M)/a,t[5]=(h-u*M)/a,t[6]=(c-e*M)/a,t[7]=(s-o*M)/a;}return t},str:function(t){return "quat2("+t[0]+", "+t[1]+", "+t[2]+", "+t[3]+", "+t[4]+", "+t[5]+", "+t[6]+", "+t[7]+")"},exactEquals:function(t,n){return t[0]===n[0]&&t[1]===n[1]&&t[2]===n[2]&&t[3]===n[3]&&t[4]===n[4]&&t[5]===n[5]&&t[6]===n[6]&&t[7]===n[7]},equals:function(t,a){var r=t[0],u=t[1],e=t[2],o=t[3],i=t[4],h=t[5],c=t[6],s=t[7],M=a[0],f=a[1],l=a[2],v=a[3],b=a[4],m=a[5],d=a[6],p=a[7];return Math.abs(r-M)<=n*Math.max(1,Math.abs(r),Math.abs(M))&&Math.abs(u-f)<=n*Math.max(1,Math.abs(u),Math.abs(f))&&Math.abs(e-l)<=n*Math.max(1,Math.abs(e),Math.abs(l))&&Math.abs(o-v)<=n*Math.max(1,Math.abs(o),Math.abs(v))&&Math.abs(i-b)<=n*Math.max(1,Math.abs(i),Math.abs(b))&&Math.abs(h-m)<=n*Math.max(1,Math.abs(h),Math.abs(m))&&Math.abs(c-d)<=n*Math.max(1,Math.abs(c),Math.abs(d))&&Math.abs(s-p)<=n*Math.max(1,Math.abs(s),Math.abs(p))}});function zn(){var t=new a(2);return a!=Float32Array&&(t[0]=0,t[1]=0),t}function Rn(t,n,a){return t[0]=n[0]-a[0],t[1]=n[1]-a[1],t}function On(t,n,a){return t[0]=n[0]*a[0],t[1]=n[1]*a[1],t}function jn(t,n,a){return t[0]=n[0]/a[0],t[1]=n[1]/a[1],t}function En(t,n){var a=n[0]-t[0],r=n[1]-t[1];return Math.hypot(a,r)}function Pn(t,n){var a=n[0]-t[0],r=n[1]-t[1];return a*a+r*r}function Tn(t){var n=t[0],a=t[1];return Math.hypot(n,a)}function Sn(t){var n=t[0],a=t[1];return n*n+a*a}var Dn=Tn,Fn=Rn,In=On,Ln=jn,Vn=En,kn=Pn,Qn=Sn,Yn=function(){var t=zn();return function(n,a,r,u,e,o){var i,h;for(a||(a=2),r||(r=0),h=u?Math.min(u*a+r,n.length):n.length,i=r;i<h;i+=a)t[0]=n[i],t[1]=n[i+1],e(t,t,o),n[i]=t[0],n[i+1]=t[1];return n}}(),Zn=Object.freeze({__proto__:null,create:zn,clone:function(t){var n=new a(2);return n[0]=t[0],n[1]=t[1],n},fromValues:function(t,n){var r=new a(2);return r[0]=t,r[1]=n,r},copy:function(t,n){return t[0]=n[0],t[1]=n[1],t},set:function(t,n,a){return t[0]=n,t[1]=a,t},add:function(t,n,a){return t[0]=n[0]+a[0],t[1]=n[1]+a[1],t},subtract:Rn,multiply:On,divide:jn,ceil:function(t,n){return t[0]=Math.ceil(n[0]),t[1]=Math.ceil(n[1]),t},floor:function(t,n){return t[0]=Math.floor(n[0]),t[1]=Math.floor(n[1]),t},min:function(t,n,a){return t[0]=Math.min(n[0],a[0]),t[1]=Math.min(n[1],a[1]),t},max:function(t,n,a){return t[0]=Math.max(n[0],a[0]),t[1]=Math.max(n[1],a[1]),t},round:function(t,n){return t[0]=Math.round(n[0]),t[1]=Math.round(n[1]),t},scale:function(t,n,a){return t[0]=n[0]*a,t[1]=n[1]*a,t},scaleAndAdd:function(t,n,a,r){return t[0]=n[0]+a[0]*r,t[1]=n[1]+a[1]*r,t},distance:En,squaredDistance:Pn,length:Tn,squaredLength:Sn,negate:function(t,n){return t[0]=-n[0],t[1]=-n[1],t},inverse:function(t,n){return t[0]=1/n[0],t[1]=1/n[1],t},normalize:function(t,n){var a=n[0],r=n[1],u=a*a+r*r;return u>0&&(u=1/Math.sqrt(u)),t[0]=n[0]*u,t[1]=n[1]*u,t},dot:function(t,n){return t[0]*n[0]+t[1]*n[1]},cross:function(t,n,a){var r=n[0]*a[1]-n[1]*a[0];return t[0]=t[1]=0,t[2]=r,t},lerp:function(t,n,a,r){var u=n[0],e=n[1];return t[0]=u+r*(a[0]-u),t[1]=e+r*(a[1]-e),t},random:function(t,n){n=n||1;var a=2*r()*Math.PI;return t[0]=Math.cos(a)*n,t[1]=Math.sin(a)*n,t},transformMat2:function(t,n,a){var r=n[0],u=n[1];return t[0]=a[0]*r+a[2]*u,t[1]=a[1]*r+a[3]*u,t},transformMat2d:function(t,n,a){var r=n[0],u=n[1];return t[0]=a[0]*r+a[2]*u+a[4],t[1]=a[1]*r+a[3]*u+a[5],t},transformMat3:function(t,n,a){var r=n[0],u=n[1];return t[0]=a[0]*r+a[3]*u+a[6],t[1]=a[1]*r+a[4]*u+a[7],t},transformMat4:function(t,n,a){var r=n[0],u=n[1];return t[0]=a[0]*r+a[4]*u+a[12],t[1]=a[1]*r+a[5]*u+a[13],t},rotate:function(t,n,a,r){var u=n[0]-a[0],e=n[1]-a[1],o=Math.sin(r),i=Math.cos(r);return t[0]=u*i-e*o+a[0],t[1]=u*o+e*i+a[1],t},angle:function(t,n){var a=t[0],r=t[1],u=n[0],e=n[1],o=Math.sqrt((a*a+r*r)*(u*u+e*e)),i=o&&(a*u+r*e)/o;return Math.acos(Math.min(Math.max(i,-1),1))},zero:function(t){return t[0]=0,t[1]=0,t},str:function(t){return "vec2("+t[0]+", "+t[1]+")"},exactEquals:function(t,n){return t[0]===n[0]&&t[1]===n[1]},equals:function(t,a){var r=t[0],u=t[1],e=a[0],o=a[1];return Math.abs(r-e)<=n*Math.max(1,Math.abs(r),Math.abs(e))&&Math.abs(u-o)<=n*Math.max(1,Math.abs(u),Math.abs(o))},len:Dn,sub:Fn,mul:In,div:Ln,dist:Vn,sqrDist:kn,sqrLen:Qn,forEach:Yn});t.glMatrix=o,t.mat2=M,t.mat2d=m,t.mat3=g,t.mat4=I,t.quat=ln,t.quat2=wn,t.vec2=Zn,t.vec3=ut,t.vec4=Pt,Object.defineProperty(t,"__esModule",{value:!0});}));

var glMatrix$1 = glMatrix;

const {mat3: mat3$4} = glMatrix$1;

const CubeSym = {
    ID: 0,
    ROT_Y: 1,
    ROT_Y2: 2,
    ROT_Y3: 3,
    ROT_Z: 4,
    ROT_Z2: 5,
    ROT_Z3: 6,
    ROT_X: 7,
    ROT_X2: 8,
    ROT_X3: 9,
    NEG_Y: 24,
    /**
     * generated
     */
    NEG_Z: 29,
    /**
     * generated
     */
    NEG_X: 32,
    matrices: [],
    _byScale: [0,0,0,0,0,0,0,0],
    _symCayley: [],
    _inv: [],

    fromScale(sx, sy, sz) {
        return CubeSym._byScale[((sx < 0) ? 1 : 0)
            + ((sy < 0) ? 2 : 0)
            + ((sz < 0) ? 4 : 0)];
    },
    fromXVec(sx, sy, sz) {
        if (sx > 0) {
            return CubeSym.ROT_Y3;
        }
        if (sx < 0) {
            return CubeSym.ROT_Y;
        }
        if (sy > 0) {
            return CubeSym.ROT_X;
        }
        if (sy < 0) {
            return CubeSym.ROT_X3;
        }
        if (sz > 0) {
            return CubeSym.ID;
        }
        if (sz < 0) {
            return CubeSym.ROT_Y2;
        }
        return CubeSym.ID;
    },
    dirAdd(sym, dir) {
        const mat = this.matrices[this.add(sym, dir)];
        return this.fromXVec(mat[2], mat[5], mat[8]);
    },
    add(symSecond, symFirst) {
        return CubeSym._symCayley[symSecond][symFirst];
    },
    sub(symSecond, symFirst) {
        return CubeSym._symCayley[symSecond][CubeSym._inv[symFirst]];
    },
    inv(sym) {
        return CubeSym._inv[sym];
    }
};

const tmp = new Float32Array(9);

function fill(startIndex, finishIndex, current) {
    const {matrices, _symCayley} = CubeSym;
    for (let i = startIndex; i < finishIndex; i++) {
        for (let j = 0; j < current; j++) {
            mat3$4.multiply(tmp, matrices[j], matrices[i]);
            let flag = false;
            for (let k=0;k<current; k++) {
                flag = true;
                for (let s=0;s<9;s++) {
                    if (matrices[k][s] !== tmp[s]) {
                        flag = false;
                        break;
                    }
                }
                if (flag) {
                    _symCayley[j][i] = k;
                    break;
                }
            }
            if (!flag) {
                matrices[current].set(tmp, 0);
                _symCayley[j][i] = current++;
            }
        }
    }
    return current;
}

function fillRest() {
    const {matrices, _symCayley, _inv, _byScale} = CubeSym;
    for (let i = 0; i < 48; i++) {
        for (let j = 0; j < 48; j++) {
            if (_symCayley[j][i] >=0) {
                continue;
            }
            mat3$4.multiply(tmp, matrices[j], matrices[i]);
            for (let k = 0; k < 48; k++) {
                let flag = true;
                for (let s = 0; s < 9; s++) {
                    if (matrices[k][s] !== tmp[s]) {
                        flag = false;
                        break;
                    }
                }
                if (flag) {
                    _symCayley[j][i] = k;
                    break;
                }
            }
        }
    }

    for (let i = 0; i < 48; i++) {
        for (let j = 0; j < 48; j++) {
            if (_symCayley[j][i] === 0) {
                _inv[i] = j;
                break;
            }
        }
    }

    for (let i = 0; i < 48; i++) {
        const mat = matrices[i];
        if (mat[0] !== 0 && mat[4] !== 0 && mat[8] !== 0) {
            const ind = (mat[0]<0?1:0) + (mat[4]<0?2:0) + (mat[8]<0?4:0);
            _byScale[ind] = i;
        }
    }
}

function init() {
    const {matrices, _symCayley, ROT_Y, ROT_Z, ROT_X, NEG_Y, NEG_Z, NEG_X} = CubeSym;
    for (let i = 0; i < 48; i++) {
        matrices[i] = new Float32Array(9);
        _symCayley[i] = [];
        for (let j=0;j<48;j++) {
            _symCayley[i].push(-1);
        }
    }
    let current = 0;
    // ID
    matrices[0][0] = 1;
    matrices[0][4] = 1;
    matrices[0][8] = 1;
    current++;
    matrices[ROT_Y][2] = -1;
    matrices[ROT_Y][4] = 1;
    matrices[ROT_Y][6] = 1;
    current++;
    mat3$4.multiply(matrices[current++], matrices[ROT_Y], matrices[ROT_Y]);
    mat3$4.multiply(matrices[current++], matrices[ROT_Y], matrices[ROT_Y+1]);
    matrices[ROT_Z][1] = -1;
    matrices[ROT_Z][3] = 1;
    matrices[ROT_Z][8] = 1;
    current++;
    mat3$4.multiply(matrices[current++], matrices[ROT_Z], matrices[ROT_Z]);
    mat3$4.multiply(matrices[current++], matrices[ROT_Z], matrices[ROT_Z+1]);
    matrices[ROT_X][0] = 1;
    matrices[ROT_X][5] = 1;
    matrices[ROT_X][7] = -1;
    current++;
    mat3$4.multiply(matrices[current++], matrices[ROT_X], matrices[ROT_X]);
    mat3$4.multiply(matrices[current++], matrices[ROT_X], matrices[ROT_X+1]);
    current = fill(0, 24, current);
    matrices[NEG_Y][0] = 1;
    matrices[NEG_Y][4] = -1;
    matrices[NEG_Y][8] = 1;
    current++;
    current = fill(24, 48, current);
    fillRest();
}

// let perf = Date.now();
init();
// perf = Date.now()-perf;
// console.log(`matrices generated for ${perf} ms`);
function pushSym(
        vertices, sym,
        cx, cz, cy,
        x0, z0, y0,
        ux, uz, uy, vx, vz, vy,
        c0, c1, c2, c3,
        r, g, b,
        flags
    ) {
    const mat = CubeSym.matrices[sym];
    vertices.push(
        cx + x0 * mat[0] + y0 * mat[1] + z0 * mat[2],
        cz + x0 * mat[6] + y0 * mat[7] + z0 * mat[8],
        cy + x0 * mat[3] + y0 * mat[4] + z0 * mat[5],

        ux * mat[0] + uy * mat[1] + uz * mat[2],
        ux * mat[6] + uy * mat[7] + uz * mat[8],
        ux * mat[3] + uy * mat[4] + uz * mat[5],

        vx * mat[0] + vy * mat[1] + vz * mat[2],
        vx * mat[6] + vy * mat[7] + vz * mat[8],
        vx * mat[3] + vy * mat[4] + vz * mat[5],

        c0, c1, c2, c3, r, g, b, flags
    );
}

// A port of an algorithm by Johannes Baagøe <baagoe@baagoe.com>, 2010
// http://baagoe.com/en/RandomMusings/javascript/
// https://github.com/nquinlan/better-random-numbers-for-javascript-mirror
// Original work is under MIT license -

// Copyright (C) 2010 by Johannes Baagøe <baagoe@baagoe.org>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.


function Alea(seed) {
  var me = this, mash = Mash();

  me.next = function() {
    var t = 2091639 * me.s0 + me.c * 2.3283064365386963e-10; // 2^-32
    me.s0 = me.s1;
    me.s1 = me.s2;
    return me.s2 = t - (me.c = t | 0);
  };

  // Apply the seeding algorithm from Baagoe.
  me.c = 1;
  me.s0 = mash(' ');
  me.s1 = mash(' ');
  me.s2 = mash(' ');
  me.s0 -= mash(seed);
  if (me.s0 < 0) { me.s0 += 1; }
  me.s1 -= mash(seed);
  if (me.s1 < 0) { me.s1 += 1; }
  me.s2 -= mash(seed);
  if (me.s2 < 0) { me.s2 += 1; }
  mash = null;
}

function copy(f, t) {
  t.c = f.c;
  t.s0 = f.s0;
  t.s1 = f.s1;
  t.s2 = f.s2;
  return t;
}

function impl(seed, opts) {
  var xg = new Alea(seed),
      state = opts && opts.state,
      prng = xg.next;
      prng.int32 = function() { return (xg.next() * 0x100000000) | 0; };
      prng.nextInt = function(max) { return (xg.next() * max) | 0; };
  prng.double = function() {
    return prng() + (prng() * 0x200000 | 0) * 1.1102230246251565e-16; // 2^-53
  };
  prng.quick = prng;
  if (state) {
    if (typeof(state) == 'object') copy(state, xg);
    prng.state = function() { return copy(xg, {}); };
  }
  return prng;
}

function Mash() {
  var n = 0xefc8249d;

  var mash = function(data) {
    data = String(data);
    for (var i = 0; i < data.length; i++) {
      n += data.charCodeAt(i);
      var h = 0.02519603282416938 * n;
      n = h >>> 0;
      h -= n;
      h *= n;
      n = h >>> 0;
      h -= n;
      n += h * 0x100000000; // 2^32
    }
    return (n >>> 0) * 2.3283064365386963e-10; // 2^-32
  };

  return mash;
}

'use strict';
let exports$1={};
//Object.defineProperty(exports, "__esModule", { value: true });
exports$1.substr = exports$1.substring = exports$1.betweenInclusive = exports$1.codePointFromSurrogatePair = exports$1.isZeroWidthJoiner = exports$1.isGraphem = exports$1.isDiacriticalMark = exports$1.isVariationSelector = exports$1.isFitzpatrickModifier = exports$1.isRegionalIndicator = exports$1.isFirstOfSurrogatePair = exports$1.nextUnits = exports$1.runes = exports$1.GRAPHEMS = exports$1.ZWJ = exports$1.DIACRITICAL_MARKS_END = exports$1.DIACRITICAL_MARKS_START = exports$1.VARIATION_MODIFIER_END = exports$1.VARIATION_MODIFIER_START = exports$1.FITZPATRICK_MODIFIER_END = exports$1.FITZPATRICK_MODIFIER_START = exports$1.REGIONAL_INDICATOR_END = exports$1.REGIONAL_INDICATOR_START = exports$1.LOW_SURROGATE_START = exports$1.HIGH_SURROGATE_END = exports$1.HIGH_SURROGATE_START = void 0;
exports$1.HIGH_SURROGATE_START = 0xd800;
exports$1.HIGH_SURROGATE_END = 0xdbff;
exports$1.LOW_SURROGATE_START = 0xdc00;
exports$1.REGIONAL_INDICATOR_START = 0x1f1e6;
exports$1.REGIONAL_INDICATOR_END = 0x1f1ff;
exports$1.FITZPATRICK_MODIFIER_START = 0x1f3fb;
exports$1.FITZPATRICK_MODIFIER_END = 0x1f3ff;
exports$1.VARIATION_MODIFIER_START = 0xfe00;
exports$1.VARIATION_MODIFIER_END = 0xfe0f;
exports$1.DIACRITICAL_MARKS_START = 0x20d0;
exports$1.DIACRITICAL_MARKS_END = 0x20ff;
exports$1.ZWJ = 0x200d;
exports$1.GRAPHEMS = [
    0x0308,
    0x0937,
    0x0937,
    0x093F,
    0x093F,
    0x0BA8,
    0x0BBF,
    0x0BCD,
    0x0E31,
    0x0E33,
    0x0E40,
    0x0E49,
    0x1100,
    0x1161,
    0x11A8, // ( ᆨ ) HANGUL JONGSEONG KIYEOK
];
function runes(string) {
    if (typeof string !== 'string') {
        throw new Error('string cannot be undefined or null');
    }
    const result = [];
    let i = 0;
    let increment = 0;
    while (i < string.length) {
        increment += nextUnits(i + increment, string);
        if (isGraphem(string[i + increment])) {
            increment++;
        }
        if (isVariationSelector(string[i + increment])) {
            increment++;
        }
        if (isDiacriticalMark(string[i + increment])) {
            increment++;
        }
        if (isZeroWidthJoiner(string[i + increment])) {
            increment++;
            continue;
        }
        result.push(string.substring(i, i + increment));
        i += increment;
        increment = 0;
    }
    return result;
}
exports$1.runes = runes;
// Decide how many code units make up the current character.
// BMP characters: 1 code unit
// Non-BMP characters (represented by surrogate pairs): 2 code units
// Emoji with skin-tone modifiers: 4 code units (2 code points)
// Country flags: 4 code units (2 code points)
// Variations: 2 code units
function nextUnits(i, string) {
    const current = string[i];
    // If we don't have a value that is part of a surrogate pair, or we're at
    // the end, only take the value at i
    if (!isFirstOfSurrogatePair(current) || i === string.length - 1) {
        return 1;
    }
    const currentPair = current + string[i + 1];
    let nextPair = string.substring(i + 2, i + 5);
    // Country flags are comprised of two regional indicator symbols,
    // each represented by a surrogate pair.
    // See http://emojipedia.org/flags/
    // If both pairs are regional indicator symbols, take 4
    if (isRegionalIndicator(currentPair) && isRegionalIndicator(nextPair)) {
        return 4;
    }
    // If the next pair make a Fitzpatrick skin tone
    // modifier, take 4
    // See http://emojipedia.org/modifiers/
    // Technically, only some code points are meant to be
    // combined with the skin tone modifiers. This function
    // does not check the current pair to see if it is
    // one of them.
    if (isFitzpatrickModifier(nextPair)) {
        return 4;
    }
    return 2;
}
exports$1.nextUnits = nextUnits;
function isFirstOfSurrogatePair(string) {
    return string && betweenInclusive(string[0].charCodeAt(0), exports$1.HIGH_SURROGATE_START, exports$1.HIGH_SURROGATE_END);
}
exports$1.isFirstOfSurrogatePair = isFirstOfSurrogatePair;
function isRegionalIndicator(string) {
    return betweenInclusive(codePointFromSurrogatePair(string), exports$1.REGIONAL_INDICATOR_START, exports$1.REGIONAL_INDICATOR_END);
}
exports$1.isRegionalIndicator = isRegionalIndicator;
function isFitzpatrickModifier(string) {
    return betweenInclusive(codePointFromSurrogatePair(string), exports$1.FITZPATRICK_MODIFIER_START, exports$1.FITZPATRICK_MODIFIER_END);
}
exports$1.isFitzpatrickModifier = isFitzpatrickModifier;
function isVariationSelector(string) {
    return typeof string === 'string' && betweenInclusive(string.charCodeAt(0), exports$1.VARIATION_MODIFIER_START, exports$1.VARIATION_MODIFIER_END);
}
exports$1.isVariationSelector = isVariationSelector;
function isDiacriticalMark(string) {
    return typeof string === 'string' && betweenInclusive(string.charCodeAt(0), exports$1.DIACRITICAL_MARKS_START, exports$1.DIACRITICAL_MARKS_END);
}
exports$1.isDiacriticalMark = isDiacriticalMark;
function isGraphem(string) {
    return typeof string === 'string' && exports$1.GRAPHEMS.indexOf(string.charCodeAt(0)) !== -1;
}
exports$1.isGraphem = isGraphem;
function isZeroWidthJoiner(string) {
    return typeof string === 'string' && string.charCodeAt(0) === exports$1.ZWJ;
}
exports$1.isZeroWidthJoiner = isZeroWidthJoiner;
function codePointFromSurrogatePair(pair) {
    const highOffset = pair.charCodeAt(0) - exports$1.HIGH_SURROGATE_START;
    const lowOffset = pair.charCodeAt(1) - exports$1.LOW_SURROGATE_START;
    return (highOffset << 10) + lowOffset + 0x10000;
}
exports$1.codePointFromSurrogatePair = codePointFromSurrogatePair;
function betweenInclusive(value, lower, upper) {
    return value >= lower && value <= upper;
}
exports$1.betweenInclusive = betweenInclusive;
function substring(string, start, width) {
    const chars = runes(string);
    if (start === undefined) {
        return string;
    }
    if (start >= chars.length) {
        return '';
    }
    const rest = chars.length - start;
    const stringWidth = width === undefined ? rest : width;
    let endIndex = start + stringWidth;
    if (endIndex > (start + rest)) {
        endIndex = undefined;
    }
    return chars.slice(start, endIndex).join('');
}
exports$1.substring = substring;
exports$1.substr = substring;
runes.substr = substring;
runes.substring = substring;
runes.default = runes;
runes.runes = runes;
Object.defineProperty(runes, "__esModule", { value: true });

const {mat4: mat4$c} = glMatrix$1;

const SNEAK_MINUS_Y_MUL      = 0.2; // decrease player height to this percent value
const MOB_EYE_HEIGHT_PERCENT = 1 - 1/16;

const CAMERA_MODE = {
    COUNT: 3,
    SHOOTER: 0,
    THIRD_PERSON: 1,
    THIRD_PERSON_FRONT: 2
};

const TX_CNT$4 = 32;

/*Object.defineProperty(String.prototype, 'hashCode', {
    value: function() {
        var hash = 0, i, chr;
        for (i = 0; i < this.length; i++) {
            chr   = this.charCodeAt(i);
            hash  = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }
});*/

/**
 * Lerp any value between
 * @param {*} a
 * @param {*} b
 * @param {number} t
 * @param {*} res
 * @returns
 */
function lerpComplex (a, b, t, res) {
    const typeA = typeof a;
    const typeB = typeof b;

    if (typeA !== typeB) {
        return res; // no emit
    }

    if (a == null || b == null) {
        return null;
    }

    if (typeA == 'boolean' || typeA === 'string') {
        return t > 0.5 ? b : a; // if < 0.5 return a, or b
    }

    if (typeA === 'number') {
        return a * (1 - t) + b * t;
    }

    if (Array.isArray(a)) {
        res = res || [];

        for (let i = 0; i < Math.min(a.length, b.length); i ++) {
            res[i] = a[i] * (1 - t) + b[i] * t;
        }

        return res;
    }

    res = res || {};

    for (const key in a) {

        res[key] = lerpComplex(
            a[key],
            b[key],
            t,
            res[key]
        );
    }

    return res;
}

class Mth {
    /**
     * Lerp any value between
     * @param {*} a
     * @param {*} b
     * @param {number} t
     * @param {*} res
     * @returns
     */
    static lerpComplex = lerpComplex;

    static lerp(amount, value1, value2) {
        amount = amount < 0 ? 0 : amount;
        amount = amount > 1 ? 1 : amount;
        return value1 + (value2 - value1) * amount;
    }

    static sin(a) {
        return Math.sin(a);
    }

    static cos(a) {
        return Math.cos(a);
    }

    static clamp (value, min, max) {
        return value < min
            ? min : (
                value > max
                    ? max
                    : value
            );
    }

    static repeat(value, length) {
        return Mth.clamp(value - Math.floor(value / length) * length, 0.0, length);
    }

    /**
     * Compute a distance between over minimal arc
     * @param {number} current
     * @param {number} target
     * @returns {number}
     */
    static deltaAngle(current, target) {
        const delta = Mth.repeat((target - current), 360.0);

        return delta > 180
            ? delta - 360.0
            : delta;
    }

    /**
     * Lerp angle with over minimal distance
     * @param {number} a - start angle
     * @param {number} b - target angle
     * @param {number} t - lerp factor
     * @returns {number}
     */
    static lerpAngle(a, b, t) {
        let delta = Mth.repeat((b - a), 360);

        if (delta > 180)
            delta -= 360;

        return a + delta * Mth.clamp(t, 0, 1);
    }

}

class IvanArray {
    constructor() {
        this.arr = [];
        this.count = 0;
    }

    clear() {
        const { count, arr } = this;
        this.count = 0;
        for (let i = 0; i < count; i++) {
            arr[i] = null;
        }
    }

    push(elem) {
        this.arr[this.count++] = elem;
    }
}

// VectorCollector...
class VectorCollector {

    static sets = 0;

    constructor(list) {
        this.clear(list);
    }

    *[Symbol.iterator]() {
        for (let x of this.list.values()) {
            for (let y of x.values()) {
                for (let value of y.values()) {
                    yield value;
                }
            }
        }
    }

    entries(aabb) {
        const that = this;
        return (function* () {
            let vec = new Vector$1(0, 0, 0);
            for (let [xk, x] of that.list) {
                if(aabb && (xk < aabb.x_min || xk > aabb.x_max)) continue;
                for (let [yk, y] of x) {
                    if(aabb && (yk < aabb.y_min || yk > aabb.y_max)) continue;
                    for (let [zk, value] of y) {
                        if(aabb && (zk < aabb.z_min || zk > aabb.z_max)) continue;
                        vec.set(xk|0, yk|0, zk|0);
                        yield [vec, value];
                    }
                }
            }
        })()
    }

    kvpIterator(aabb) {
        return this.entries(aabb);
    }

    clear(list) {
        this.list = list ? list : new Map();
        this.size = 0;
    }

    set(vec, value) {
        let size = this.size;
        if(!this.list.has(vec.x)) this.list.set(vec.x, new Map());
        if(!this.list.get(vec.x).has(vec.y)) this.list.get(vec.x).set(vec.y, new Map());
        if(!this.list.get(vec.x).get(vec.y).has(vec.z)) {
            this.size++;
        }
        if (typeof value === 'function') {
            value = value(vec);
        }
        this.list.get(vec.x).get(vec.y).set(vec.z, value);
        return this.size > size;
    }

    add(vec, value) {
        if(!this.list.has(vec.x)) this.list.set(vec.x, new Map());
        if(!this.list.get(vec.x).has(vec.y)) this.list.get(vec.x).set(vec.y, new Map());
        if(!this.list.get(vec.x).get(vec.y).has(vec.z)) {
            if (typeof value === 'function') {
                value = value(vec);
            }
            this.list.get(vec.x).get(vec.y).set(vec.z, value);
            this.size++;
        }
        return this.list.get(vec.x).get(vec.y).get(vec.z);
    }

    delete(vec) {
        if(this.list?.get(vec.x)?.get(vec.y)?.delete(vec.z)) {
            this.size--;
            return true;
        }
        return false;
    }

    has(vec) {
        return this.list.get(vec.x)?.get(vec.y)?.has(vec.z) || false;
        //if(!this.list.has(vec.x)) return false;
        //if(!this.list.get(vec.x).has(vec.y)) return false;
        //if(!this.list.get(vec.x).get(vec.y).has(vec.z)) return false;
        //return true;
    }

    get(vec) {
        return this.list.get(vec.x)?.get(vec.y)?.get(vec.z) || null;
        // if(!this.list.has(vec.x)) return null;
        // if(!this.list.get(vec.x).has(vec.y)) return null;
        // if(!this.list.get(vec.x).get(vec.y).has(vec.z)) return null;
    }

    keys() {
        let resp = [];
        for (let [xk, x] of this.list) {
            for (let [yk, y] of x) {
                for (let [zk, z] of y) {
                    resp.push(new Vector$1(xk|0, yk|0, zk|0));
                }
            }
        }
        return resp;
    }

    values() {
        let resp = [];
        for(let item of this) {
            resp.push(item);
        }
        return resp;
    }

    reduce(max_size) {
        if(this.size < max_size) {
            return false;
        }
        /*
        let keys = Object.keys(this.maps_cache);
        if(keys.length > MAX_ENTR) {
            let del_count = Math.floor(keys.length - MAX_ENTR * 0.333);
            console.info('Clear maps_cache, del_count: ' + del_count);
            for(let key of keys) {
                if(--del_count == 0) {
                    break;
                }
                delete(this.maps_cache[key]);
            }
        }
        */
    }

}

// Color
class Color {

    static componentToHex(c) {
        var hex = c.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    }

    static hexToColor(hex_color) {
        var c;
        if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex_color)) {
            c = hex_color.substring(1).split('');
            if(c.length == 3){
                c = [c[0], c[0], c[1], c[1], c[2], c[2]];
            }
            c = '0x' + c.join('');
            return new Color((c>>16)&255, (c>>8)&255, c&255, 255); // 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+',1)';
        }
        throw new Error('Bad Hex');
    }

    constructor(r, g, b, a) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }

    add(color) {
        this.r += color.r;
        this.g += color.g;
        this.b += color.b;
        this.a += color.a;
        return this;
    }

    divide(color) {
        this.r /= color.r;
        this.g /= color.g;
        this.b /= color.b;
        this.a /= color.a;
        return this;
    }

    set(r, g, b, a) {
        if(r instanceof Color) {
            g = r.g;
            b = r.b;
            a = r.a;
            r = r.r;
        }
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
        return this;
    }

    /**
     * @return {Color}
     */
    toFloat()  {
        return new Color(this.r / 255, this.g / 255, this.b / 255, this.a / 255);
    }

    /**
     * @return {string}
     */
    toCSS()  {
        return 'rgb(' + [this.r, this.g, this.b, this.a].join(',') + ')';
    }

    clone() {
        return new Color(this.r, this.g, this.b, this.a);
    }

    toHex() {
        return "#" + Color.componentToHex(this.r) +
            Color.componentToHex(this.g) +
            Color.componentToHex(this.b) +
            Color.componentToHex(this.a);
    }

    toArray() {
        return [this.r, this.g, this.b, this.a];
    }

}

class Vector$1 {

    // static cnt = 0;
    // static traces = new Map();

    static XN = new Vector$1(-1.0, 0.0, 0.0);
    static XP = new Vector$1(1.0, 0.0, 0.0);
    static YN = new Vector$1(0.0, -1.0, 0.0);
    static YP = new Vector$1(0.0, 1.0, 0.0);
    static ZN = new Vector$1(0.0, 0.0, -1.0);
    static ZP = new Vector$1(0.0, 0.0, 1.0);
    static ZERO = new Vector$1(0.0, 0.0, 0.0);

    /**
     *
     * @param {Vector | {x: number, y: number, z: number} | number[]} [x]
     * @param {number} [y]
     * @param {number} [z]
     */
    constructor(x, y, z) {
        this.x = 0;
        this.y = 0;
        this.z = 0;

        this.set(x, y, z);
    }

    //Array like proxy for usign it in gl-matrix
    get [0]() {
        return this.x;
    }

    set [0](v) {
        this.x = v;
    }

    get [1]() {
        return this.y;
    }

    set [1](v) {
        this.y = v;
    }

    get [2]() {
        return this.z;
    }

    set [2](v) {
        this.z = v;
    }

    // array like iterator
    *[Symbol.iterator]() {
        yield this.x;
        yield this.y;
        yield this.z;
    }

    // array like object lenght
    get length() {
        return 3;
    }

    /**
     * @param {Vector} vec
     */
    copyFrom(vec) {
        this.x = vec.x;
        this.y = vec.y;
        this.z = vec.z;
        return this;
    }

    /**
     * @param {Vector} vec
     * @return {boolean}
     */
    equal(vec) {
        return this.x === vec.x && this.y === vec.y && this.z === vec.z;
    }

    /**
     * @param {Vector} vec1
     * @param {Vector} vec2
     * @param {number} delta
     * @return {void}
     */
    lerpFrom(vec1, vec2, delta) {
        this.x = vec1.x * (1.0 - delta) + vec2.x * delta;
        this.y = vec1.y * (1.0 - delta) + vec2.y * delta;
        this.z = vec1.z * (1.0 - delta) + vec2.z * delta;
        return this;
    }

    /**
     * @param {Vector} vec1
     * @param {Vector} vec2
     * @param {number} delta
     * @param {boolean} rad
     * @return {void}
     */
    lerpFromAngle(vec1, vec2, delta, rad = false) {
        const coef = rad
            ? 180 / Math.PI
            : 1;

        this.x = Mth.lerpAngle(vec1.x * coef, vec2.x * coef, delta) / coef;
        this.y = Mth.lerpAngle(vec1.y * coef, vec2.y * coef, delta) / coef;
        this.z = Mth.lerpAngle(vec1.z * coef, vec2.z * coef, delta) / coef;
        return this;
    }

    /**
     * @param {Vector} vec
     * @return {Vector}
     */
    add(vec) {
        return new Vector$1(this.x + vec.x, this.y + vec.y, this.z + vec.z);
    }

    /**
     * @param {Vector} vec
     * @return {Vector}
     */
    addSelf(vec) {
        this.x += vec.x;
        this.y += vec.y;
        this.z += vec.z;
        return this;
    }

    /**
     * @param {Vector} vec
     * @return {Vector}
     */
    sub(vec) {
        return new Vector$1(this.x - vec.x, this.y - vec.y, this.z - vec.z);
    }

    /**
     * @param {Vector} vec
     * @return {Vector}
     */
    subSelf(vec) {
        this.x -= vec.x;
        this.y -= vec.y;
        this.z -= vec.z;
        return this;
    }

    /**
     * @param {Vector} vec
     * @return {Vector}
     */
    mul(vec) {
        return new Vector$1(this.x * vec.x, this.y * vec.y, this.z * vec.z);
    }

    /**
     * @param {Vector} vec
     * @return {Vector}
     */
    div(vec) {
        return new Vector$1(this.x / vec.x, this.y / vec.y, this.z / vec.z);
    }

    zero() {
        this.x = 0;
        this.y = 0;
        this.z = 0;
        return this;
    }

    /**
     * @return {Vector}
     */
    swapYZ() {
        return new Vector$1(this.x, this.z, this.y);
    }

    /**
     * @return {number}
     */
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    /**
     * @param {Vector} vec
     * @return {number}
     */
    distance(vec) {
        // return this.sub(vec).length();
        // Fast method
        let x = this.x - vec.x;
        let y = this.y - vec.y;
        let z = this.z - vec.z;
        return Math.sqrt(x * x + y * y + z * z);
    }

    /**
     * @param {Vector} vec
     * @return {number}
     */
    horizontalDistance(vec) {
        const x = this.x - vec.x;
        const z = this.z - vec.z;
        return Math.sqrt(x * x + z * z);
    }

    // distancePointLine...
    distanceToLine(line_start, line_end, intersection = null) {
        intersection = intersection || new Vector$1(0, 0, 0);
        let dist = line_start.distance(line_end);
        let u = (((this.x - line_start.x) * (line_end.x - line_start.x)) +
            ((this.y - line_start.y) * (line_end.y - line_start.y)) +
            ((this.z - line_start.z) * (line_end.z - line_start.z))) /
            (dist * dist);
        if(u < 0) u = 0;
        if(u > 1) u = 1;
        intersection.x = line_start.x + u * (line_end.x - line_start.x);
        intersection.y = line_start.y + u * (line_end.y - line_start.y);
        intersection.z = line_start.z + u * (line_end.z - line_start.z);
        return this.distance(intersection);
    }

    /**
     * @return {Vector}
     */
    normal() {
        if(this.x == 0 && this.y == 0 && this.z == 0) return new Vector$1(0, 0, 0);
        let l = this.length();
        return new Vector$1(this.x / l, this.y / l, this.z / l);
    }

    normSelf() {
        const l = this.length();
        this.x /= l;
        this.y /= l;
        this.z /= l;
        return this;
    }

    /**
     * @param {Vector} vec
     * @return {number}
     */
    dot(vec) {
        return this.x * vec.x + this.y * vec.y + this.z * vec.z;
    }

    /**
     * @return {Vector}
     */
    round(decimals) {
        return this.roundSelf(decimals).clone();
    }

    /**
     * @returns {Vector}
     */
    roundSelf(decimals) {
        if(decimals) {
            decimals = Math.pow(10, decimals);
            this.x = Math.round(this.x * decimals) / decimals;
            this.y = Math.round(this.y * decimals) / decimals;
            this.z = Math.round(this.z * decimals) / decimals;
            return this;
        }
        this.x = Math.round(this.x);
        this.y = Math.round(this.y);
        this.z = Math.round(this.z);
        return this;
    }

    /**
     * @return {Vector}
     */
    toInt() {
        return new Vector$1(
            this.x | 0,
            this.y | 0,
            this.z | 0
        );
    }

    /**
     * @return {Vector}
     */
    clone() {
        return new Vector$1(
            this.x,
            this.y,
            this.z
        );
    }

    /**
     * @return {number[]}
     */
    toArray() {
        return [this.x, this.y, this.z];
    }

    /**
     * @return {string}
     */
    toString() {
        return '(' + this.x + ',' + this.y + ',' + this.z + ')';
    }

    /**
     * @return {string}
     */
    toChunkKey() {
        return 'c_' + this.x + '_' + this.y + '_' + this.z;
    }

    /**
     * @return {string}
     */
    toHash() {
        return this.x + ',' + this.y + ',' + this.z;
    }

    /**
     * @return {number}
     */
    norm() {
        return this.length();
    }

    /**
     * @return {Vector}
     */
    normalize() {
        return this.normal();
    }

    offset(x, y, z) {
        return this.add(new Vector$1(x, y, z));
    }

    /**
     * @return {Vector}
     */
    floored() {
        return new Vector$1(
            Math.floor(this.x),
            Math.floor(this.y),
            Math.floor(this.z)
        );
    }

    /**
     * @return {Vector}
     */
    flooredSelf() {
        this.x = Math.floor(this.x);
        this.y = Math.floor(this.y);
        this.z = Math.floor(this.z);
        return this;
    }

    translate(x, y, z) {
        this.x += x;
        this.y += y;
        this.z += z;
        return this;
    }

    /**
     *
     * @param {Vector | {x: number, y: number, z: number} | number[]} x
     * @param {number} [y]
     * @param {number} [z]
     */
    set(x, y = x, z = x) {
        if (typeof x == "object" && x) {
            return this.copy(x);
        }

        // maybe undef
        this.x = x || 0;
        this.y = y || 0;
        this.z = z || 0;
        return this;
    }

    multiplyScalar(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        this.z *= scalar;
        return this;
    }

    multiplyVecSelf(vec) {
        this.x *= vec.x;
        this.y *= vec.y;
        this.z *= vec.z;
        return this;
    }

    divScalar(scalar) {
        this.x /= scalar;
        this.y /= scalar;
        this.z /= scalar;
        return this;
    }

    divScalarVec(vec) {
        this.x /= vec.x;
        this.y /= vec.y;
        this.z /= vec.z;
        return this;
    }

    toAngles() {
        // N = 0
        // W = 1
        // S = 2
        // E = 3
        this.z = this.x * (-Math.PI/2);
        this.x = 0;
        this.y = 0;
        return this;
    }

    volume(vec) {
        const volx = Math.abs(this.x - vec.x) + 1;
        const voly = Math.abs(this.y - vec.y) + 1;
        const volz = Math.abs(this.z - vec.z) + 1;
        return volx * voly * volz;
    }

    /**
     *
     * @param {Vector | number[] | {x: number, y: number, z: number}} from
     */
    copy(from) {
        if (from == null) {
            return this;
        }

        // array like object with length 3 or more
        // for gl-matix
        if (from.length >= 3) {
            this.x = from[0];
            this.y = from[1];
            this.z = from[2];

            return this;
        }

        // object is simple and has x, y, z props
        if ('x' in from) {
            this.x = from.x;
            this.y = from.y;
            this.z = from.z;
        }

        return this;
    }

    /**
     * TO DO EN поворот внутри чанка вокруг y
     * @param {DIRECTION_BIT} dir
     * @return {Vector}
     */
    rotY(dir) {
        let tmp_x = this.x, tmp_y = this.y, tmp_z = this.z;
        if (dir == DIRECTION.EAST){
            this.x = tmp_z;
            this.z = 15 - tmp_x;
        }
        if (dir == DIRECTION.NORTH){
            this.x = 15 - tmp_x;
            this.z = 15 - tmp_z;
        }
        if (dir == DIRECTION.WEST){
            this.x = 15 - tmp_z;
            this.z = tmp_x;
        }
        return this;
    }

    addByCardinalDirectionSelf(vec, dir, mirror_x = false, mirror_z = false) {
        const x_sign = mirror_x ? -1 : 1;
        const z_sign = mirror_z ? -1 : 1;
        dir = dir % 4;
        this.y += vec.y;
        if(dir == DIRECTION.SOUTH) {
            this.x -= vec.x * x_sign;
            this.z -= vec.z * z_sign;
        } else if(dir == DIRECTION.NORTH) {
            this.x += vec.x * x_sign;
            this.z += vec.z * z_sign;
        } else if(dir == DIRECTION.WEST) {
            this.z += vec.x * x_sign;
            this.x -= vec.z * z_sign;
        } else  if(dir == DIRECTION.EAST) {
            this.z -= vec.x * x_sign;
            this.x += vec.z * z_sign;
        }
        return this;
    }

    //
    moveToSelf(rotate, dist) {
        this.x += dist * Math.cos(rotate.x) * Math.sin(rotate.z - Math.PI);
        this.y += dist * Math.sin(-rotate.x);
        this.z += dist * Math.cos(rotate.x) * Math.cos(rotate.z - Math.PI);
        return this;
    }


}

class Vec3 extends Vector$1 {}

let MULTIPLY = {
    COLOR: {
        WHITE: new Color(816 / 1024, 1008 / 1024, 0, 0),
        GRASS: new Color(900 / 1024, 965 / 1024, 0, 0)
    }
};

let QUAD_FLAGS = {};
    QUAD_FLAGS.NORMAL_UP = 1 << 0;
    QUAD_FLAGS.MASK_BIOME = 1 << 1;
    QUAD_FLAGS.NO_AO = 1 << 2;
    QUAD_FLAGS.NO_FOG = 1 << 3;
    QUAD_FLAGS.LOOK_AT_CAMERA = 1 << 4;
    QUAD_FLAGS.FLAG_ANIMATED = 1 << 5;

let ROTATE = {};
    ROTATE.S = CubeSym.ROT_Y2; // front
    ROTATE.W = CubeSym.ROT_Y; // left
    ROTATE.N = CubeSym.ID; // back
    ROTATE.E = CubeSym.ROT_Y3; // right


let NORMALS = {};
    NORMALS.FORWARD          = new Vector$1(0, 0, 1);
    NORMALS.BACK             = new Vector$1(0, 0, -1);
    NORMALS.LEFT             = new Vector$1(-1, 0, 0);
    NORMALS.RIGHT            = new Vector$1(1, 0, 0);
    NORMALS.UP               = new Vector$1(0, 1, 0);
    NORMALS.DOWN             = new Vector$1(0, -1, 0);

// Direction enumeration
let DIRECTION = {};
    DIRECTION.UP        = CubeSym.ROT_X;
    DIRECTION.DOWN      = CubeSym.ROT_X3;
    DIRECTION.LEFT      = CubeSym.ROT_Y;
    DIRECTION.RIGHT     = CubeSym.ROT_Y3;
    DIRECTION.FORWARD   = CubeSym.ID;
    DIRECTION.BACK      = CubeSym.ROT_Y2;
    // Aliases
    DIRECTION.WEST      = DIRECTION.LEFT;
    DIRECTION.EAST      = DIRECTION.RIGHT;
    DIRECTION.NORTH     = DIRECTION.FORWARD;
    DIRECTION.SOUTH     = DIRECTION.BACK;

let DIRECTION_BIT$1 = {};
    DIRECTION_BIT$1.UP    = 0;
    DIRECTION_BIT$1.DOWN  = 1;
    DIRECTION_BIT$1.EAST  = 2;
    DIRECTION_BIT$1.WEST  = 3;
    DIRECTION_BIT$1.NORTH = 4;
    DIRECTION_BIT$1.SOUTH = 5;

// Direction names
let DIRECTION_NAME = {};
    DIRECTION_NAME.up        = DIRECTION.UP;
    DIRECTION_NAME.down      = DIRECTION.DOWN;
    DIRECTION_NAME.left      = DIRECTION.LEFT;
    DIRECTION_NAME.right     = DIRECTION.RIGHT;
    DIRECTION_NAME.forward   = DIRECTION.FORWARD;
    DIRECTION_NAME.back      = DIRECTION.BACK;

class Helpers {

    static cache = new Map();
    static fetch;
    static fs;

    static setCache(cache) {
        Helpers.cache = cache;
    }

    static getCache() {
        return Helpers.cache;
    }

    // 
    angleTo(pos, target) {
        let angle = Math.atan2(target.x - pos.x, target.z - pos.z);
        return (angle > 0) ? angle : angle + 2 * Math.PI;
    }

    // clamp
    static clamp(x, min, max) {
        if(!min) {
            min = 0;
        }
        if(!max) {
            max = 1;
        }
        if(x < min) return min;
        if(x > max) return max;
        return x;
    }

    // str byteToHex(uint8 byte)
    // converts a single byte to a hex string
    static byteToHex(byte) {
        return ('0' + byte.toString(16)).slice(-2);
    }

    // str generateId(int len);
    // len - must be an even number (default: 32)
    static generateID() {
        const len = 32;
        let arr = new Uint8Array(len / 2);
        window.crypto.getRandomValues(arr);
        return Array.from(arr, Helpers.byteToHex).join('');
    }

    static distance(p, q) {
        let dx   = p.x - q.x;
        let dy   = p.y - q.y;
        let dz   = p.z - q.z;
        let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        return dist;
    }

    // getRandomInt...
    static getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min)) + min; // Максимум не включается, минимум включается
    }

    static createSkinLayer2(text, image, callback) {
        let canvas          = document.createElement('canvas');
        canvas.width        = 64;
        canvas.height       = 64;
        let ctx             = canvas.getContext('2d');
        if(text) {
            ctx.fillStyle       = '#f5f5f5';
            ctx.fillRect(0, 0, 200, 200);
            ctx.font            = 'bold 20px Arial';
            ctx.fillStyle       = '#333333';
            ctx.textAlign       = 'start';
            ctx.textBaseline    = 'top';
            ctx.fillText(text, 10, 10);
        } else {
            // img, sx, sy, swidth, sheight, x, y, width, height
            // head
            ctx.drawImage(image, 32, 0, 32, 16, 0, 0, 32, 16);
            // body + right leg + right arm
            ctx.drawImage(image, 0, 32, 56, 16, 0, 16, 56, 16);
            // left leg
            ctx.drawImage(image, 0, 48, 16, 16, 16, 48, 16, 16);
            // left arm
            ctx.drawImage(image, 0, 48, 48, 16, 32, 48, 16, 16);
        }
        // Debug
        // var link = document.createElement('a');
        // link.download = 'filename.png';
        // link.href = canvas.toDataURL()
        // link.click();
        canvas.toBlob(function(blob) {
            let filefromblob = new File([blob], 'image.png', {type: 'image/png'});
            callback(filefromblob);
        }, 'image/png');
    }

    // Canvas download
    static downloadBlobPNG(blob, filename) {
        /// create an "off-screen" anchor tag
        let lnk = document.createElement('a'), e;
        /// the key here is to set the download attribute of the a tag
        lnk.download = filename;
        /// convert canvas content to data-uri for link. When download
        /// attribute is set the content pointed to by link will be
        /// pushed as "download" in HTML5 capable browsers
        lnk.href = URL.createObjectURL(blob);
        /// create a "fake" click-event to trigger the download
        if (document.createEvent) {
            e = document.createEvent('MouseEvents');
            e.initMouseEvent('click', true, true, window,
            0, 0, 0, 0, 0, false, false, false,
            false, 0, null);
            lnk.dispatchEvent(e);
        } else if (lnk.fireEvent) {
            lnk.fireEvent('onclick');
        }
    }

    // downloadImage
    static downloadImage(image, filename) {
        var c = document.createElement('canvas');
        var ctx = c.getContext('2d');
        ctx.canvas.width  = image.width;
        ctx.canvas.height = image.height;
        ctx.drawImage(image, 0, 0);
        c.toBlob(function(blob) {
            // here the image is a blob
            Helpers.downloadBlobPNG(blob, filename);
        }, 'image/png');
    }

    static deg2rad(degrees) {
        return degrees * (Math.PI / 180);
    }

    static rad2deg(radians) {
        return radians * 180 / Math.PI;
    }

    static async loadJSON(url, callback) {
        await loadText(url, function(text) {
            callback(JSON.parse(text));
        });
    }

    // createGLProgram...
    static createGLProgram(gl, obj, callback) {
        let program = gl.createProgram();
        // Compile vertex shader
        let vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, obj.vertex);
        gl.compileShader(vertexShader);
        gl.attachShader(program, vertexShader);
        gl.deleteShader(vertexShader);
        if(!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            throw "Could not compile vertex shader!\n" + gl.getShaderInfoLog(vertexShader);
        }
        // Compile fragment shader
        let fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, obj.fragment);
        gl.compileShader(fragmentShader);
        gl.attachShader(program, fragmentShader);
        gl.deleteShader(fragmentShader);
        if(!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            throw "Could not compile fragment shader!\n" + gl.getShaderInfoLog(fragmentShader);
        }
        // Finish program
        gl.linkProgram(program);
        if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw 'Could not link the shader program!';
        }

        callback && callback({
            program
        });

        return program;
    }

    // Return from green to red color depend on percentage
    static getColorForPercentage(pct) {
        var percentColors = [
            {pct: 0.0, color: {r: 0xff, g: 0x00, b: 0}},
            {pct: 0.5, color: {r: 0xff, g: 0xff, b: 0}},
            {pct: 1.0, color: {r: 0x00, g: 0xff, b: 0}}
        ];
        for (var i = 1; i < percentColors.length - 1; i++) {
            if (pct < percentColors[i].pct) {
                break;
            }
        }
        var lower = percentColors[i - 1];
        var upper = percentColors[i];
        var range = upper.pct - lower.pct;
        var rangePct = (pct - lower.pct) / range;
        var pctLower = 1 - rangePct;
        var pctUpper = rangePct;
        var color = {
            r: Math.floor(lower.color.r * pctLower + upper.color.r * pctUpper),
            g: Math.floor(lower.color.g * pctLower + upper.color.g * pctUpper),
            b: Math.floor(lower.color.b * pctLower + upper.color.b * pctUpper)
        };
        return new Color(color.r, color.g, color.b, 1);
        // or output as hex if preferred
    }

    // Return speed
    static calcSpeed(pos1, pos2, delta) {
        return Math.round(pos1.distance(pos2) / delta * 360) / 100;
    }

}

// Make fetch functions
if(typeof fetch === 'undefined') {
    eval(`Helpers.fetch = async (url) => import(url);
    Helpers.fetchJSON = async (url) => import(url, {assert: {type: 'json'}}).then(response => response.default);
    Helpers.fetchBinary = async (url) => {
        let binary = fs.readFileSync(url);
        return binary.buffer;
    };`);
} else {
    Helpers.fetch = async (url) => fetch(url);
    Helpers.fetchJSON = async (url, useCache = false, namespace = '') => {
        const cacheKey = namespace + '|' + url;

        if (useCache && Helpers.cache.has(cacheKey)) {
            return Promise.resolve(JSON.parse(Helpers.cache.get(cacheKey)));
        }

        const respt = await fetch(url);

        // if cache is presented - store text response
        // then we can use this inside a worker
        if (useCache) {
            const text = await respt.text();

            Helpers.cache.set(cacheKey, text);

            return JSON.parse(text);
        }

        return respt.json()
    };

    Helpers.fetchBinary = async (url) => fetch(url).then(response => response.arrayBuffer());
}

// SpiralGenerator ...
class SpiralGenerator {

    static cache = new Map();
    static cache3D = {};

    // generate ...
    static generate(margin) {
        let size = margin * 2;
        if(SpiralGenerator.cache.has(margin)) {
            return SpiralGenerator.cache.get[margin];
        }
        var resp = [];
        function rPush(vec) {
            // Если позиция на расстояние видимости (считаем честно, по кругу)
            let x = vec.x - size / 2;
            let z = vec.z - size / 2;
            let dist = Math.sqrt(x * x + z * z);
            if(dist < margin) {
                resp.push(vec);
            }
        }
        let iInd = parseInt(size / 2);
        let jInd = parseInt(size / 2);
        let iStep = 1;
        let jStep = 1;
        rPush(new Vector$1(iInd, 0, jInd));
        for(let i = 0; i < size; i++) {
            for (let h = 0; h < i; h++) rPush(new Vector$1(iInd, 0, jInd += jStep));
            for (let v = 0; v < i; v++) rPush(new Vector$1(iInd += iStep, 0, jInd));
            jStep = -jStep;
            iStep = -iStep;
        }
        for(let h = 0; h < size - 1; h++) {
            rPush(new Vector$1(iInd, 0, jInd += jStep));
        }
        SpiralGenerator.cache.set(margin, resp);
        return resp;
    }

    /**
     * generate3D
     * @param {Vector} vec_margin
     * @returns
     */
    static generate3D(vec_margin) {
        let cache_key = vec_margin.toString();
        if(SpiralGenerator.cache3D.hasOwnProperty(cache_key)) {
            return SpiralGenerator.cache3D[cache_key];
        }
        let resp        = [];
        let center      = new Vector$1(0, 0, 0);
        let exists      = [];
        const MAX_DIST  = vec_margin.x;
        for(let y = -vec_margin.y; y <= vec_margin.y; y++) {
            for(let x = -vec_margin.x; x <= vec_margin.x; x++) {
                for(let z = -vec_margin.z; z <= vec_margin.z; z++) {
                    let vec = new Vector$1(x, y, z);
                    let dist = Math.round(vec.distance(center) * 1000) / 1000;
                    if(dist <= MAX_DIST) {
                        let key = vec.toString();
                        if(exists.indexOf(key) < 0) {
                            resp.push({pos: vec, dist: dist});
                            exists[key] = true;
                        }
                    }
                }
            }
        }
        resp.sort(function(a, b) {
            return a.dist - b.dist;
        });
        SpiralGenerator.cache3D[cache_key] = resp;
        return resp;
    }

}

function loadText(url, callback) {
    let xobj = new XMLHttpRequest();
    xobj.overrideMimeType('application/json');
    xobj.open('GET', url, true); // Replace 'my_data' with the path to your file
    xobj.onreadystatechange = function() {
        if (xobj.readyState == 4 && xobj.status == '200') {
            // Required use of an anonymous callback as .open will NOT return a value but simply returns undefined in asynchronous mode
            callback(xobj.responseText);
        }
    };
    xobj.send(null);
}

class Vector4 {

    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
}

// AverageClockTimer
class AverageClockTimer {

    constructor() {
        this.prev       = null,
        this.min        = null,
        this.max        = null,
        this.avg        = null,
        this.sum        = 0,
        this.history_index = 0;
        this.history    = new Array(60).fill(0);
    }

    add(value) {
        this.prev = value;
        if(this.min === null || this.min > value) {
            this.min = value;
        }
        if(this.max === null || this.max < value) {
            this.max = value;
        }
        //
        this.sum += value;
        this.history_index++;
        if(this.history_index == this.history.length) {
            this.history_index = 0;
        }
        this.sum -= this.history[this.history_index];
        this.history[this.history_index] = value;
        this.avg = (this.sum / this.history.length) || 0;
    }

}

// FastRandom...
class FastRandom {

    constructor(seed, cnt) {
        const a = new impl(seed);
        this.int32s = new Array(cnt);
        this.doubles = new Array(cnt);
        this.index = 0;
        this.cnt = cnt;
        for(let i = 0; i < cnt; i++) {
            this.int32s[i] = a.int32();
            this.doubles[i] = a.double();
        }
    }

    double(offset) {
        offset = Math.abs(offset) % this.cnt;
        return this.doubles[offset];
    }

    int32(offset) {
        offset = Math.abs(offset) % this.cnt;
        return this.int32s[offset];
    }

}

class RuneStrings {

    static toArray(str) {
        return runes(str);
    }

    // Разделяет слово на строки, в которых максимум указанное в [chunk] количество букв (с учётом emoji)
    static toChunks(str, chunk) {
        const rs = runes(str);
        if(rs.length > chunk) {
            let i, j, resp = [];
            for (i = 0, j = rs.length; i < j; i += chunk) {
                resp.push(rs.slice(i, i + chunk).join(''));
            }
            return resp;
        }
        return [str];
    }

    // Разделяет длинные слова пробелами (с учётом emoji)
    static splitLongWords(str, max_len) {
        let text = str.replaceAll("\r", "¡");
        let temp = text.split(' ');
        for(let i = 0; i < temp.length; i++) {
            let word = temp[i];
            if(word) {
                temp[i] = RuneStrings.toChunks(word, max_len).join(' ');
            }
        }
        return temp.join(' ').replaceAll("¡", "\r");
    }

}

// AlphabetTexture
class AlphabetTexture {

    static width            = 1024;
    static height           = 1024;
    static char_size        = {width: 32, height: 32};
    static char_size_norm   = {width: this.char_size.width / this.width, height: this.char_size.height / this.height};
    static chars            = new Map();

    static default_runes = RuneStrings.toArray('�•█—абвгдеёжзийклмнопрстуфхцчшщъыьэюя АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ0123456789~`@#№$;:\\/*-+()[]{}-^_&?!%=<>.,|"\'abcdefghjiklmnopqrstuvwxyzABCDEFGHJIKLMNOPQRSTUVWXYZ😂😃🧘🏻‍♂️🌍🌦️🚗📞🎉❤️🍆🏁💩👨‍👩‍👧‍👦👨‍👦‍👦👨‍👧‍👧👍👍🏾');

    static init() {
        if(this.chars_x) {
            return false;
        }
        this.chars_x = Math.floor(this.width / this.char_size.width);
        this.getStringUVs(AlphabetTexture.default_runes.join(''), true);
    }

    static indexToPos(index) {
        const x = (index % this.chars_x) * this.char_size.width;
        const y = Math.floor(index / this.chars_x) * this.char_size.height;
        return {x: x, y: y};
    }

    static getStringUVs(str, init_new) {
        this.init();
        let chars = RuneStrings.toArray(str);
        let resp = [];
        for(let char of chars) {
            if(init_new && !this.chars.has(char)) {
                const index = this.chars.size;
                let pos = this.indexToPos(index);
                pos.xn = pos.x / this.width;
                pos.yn = pos.y / this.height;
                pos.char = char;
                pos.index = index;
                this.chars.set(char, pos);
            }
            let item = this.chars.has(char) ? this.chars.get(char) : this.chars.get('�');
            if(char == "\r") {
                item.char = char;
            }
            resp.push(item);
        }
        return resp;
    }

}

function fromMat3(a, b) {
    a[ 0] = b[ 0];
    a[ 1] = b[ 1];
    a[ 2] = b[ 2];

    a[ 4] = b[ 3];
    a[ 5] = b[ 4];
    a[ 6] = b[ 5];

    a[ 8] = b[ 6];
    a[ 9] = b[ 7];
    a[10] = b[ 8];

    a[ 3] = a[ 7] = a[11] =
    a[12] = a[13] = a[14] = 0;
    a[15] = 1.0;

    return a;
}

// calcRotateMatrix
function calcRotateMatrix(material, rotate, cardinal_direction, matrix) {
    // Can rotate
    if(material.can_rotate) {
        //
        if(rotate) {

            if (CubeSym.matrices[cardinal_direction][4] <= 0) {
                matrix = fromMat3(new Float32Array(16), CubeSym.matrices[cardinal_direction]);
                /*
                // Use matrix instead!
                if (matrix) {
                    mat3.multiply(tempMatrix, matrix, CubeSym.matrices[cardinal_direction]);
                    matrix = tempMatrix;
                } else {
                    matrix = CubeSym.matrices[cardinal_direction];
                }
                */
            } else if(rotate.y != 0) {
                if(material.tags.indexOf('rotate_by_pos_n') >= 0 ) {
                    matrix = mat4$c.create();
                    if(rotate.y == 1) {
                        // on the floor
                        mat4$c.rotateY(matrix, matrix, (rotate.x / 4) * (2 * Math.PI) + Math.PI);
                    } else {
                        // on the ceil
                        mat4$c.rotateZ(matrix, matrix, Math.PI);
                        mat4$c.rotateY(matrix, matrix, (rotate.x / 4) * (2 * Math.PI) + Math.PI*2);
                    }
                }
            }
        }
    }
    return matrix;
}

function toType(a) {
    // Get fine type (object, array, function, null, error, date ...)
    return ({}).toString.call(a).match(/([a-z]+)(:?\])/i)[1];
}

function isDeepObject(obj) {
    return "Object" === toType(obj);
}

function deepAssign(options) {
    return function deepAssignWithOptions (target, ...sources) {
        sources.forEach( (source) => {

            if (!isDeepObject(source) || !isDeepObject(target))
                return;

            // Copy source's own properties into target's own properties
            function copyProperty(property) {
                const descriptor = Object.getOwnPropertyDescriptor(source, property);
                //default: omit non-enumerable properties
                if (descriptor.enumerable || options.nonEnum) {
                    // Copy in-depth first
                    if (isDeepObject(source[property]) && isDeepObject(target[property]))
                        descriptor.value = deepAssign(options)(target[property], source[property]);
                    //default: omit descriptors
                    if (options.descriptors)
                        Object.defineProperty(target, property, descriptor); // shallow copy descriptor
                    else
                        target[property] = descriptor.value; // shallow copy value only
                }
            }

            // Copy string-keyed properties
            Object.getOwnPropertyNames(source).forEach(copyProperty);

            //default: omit symbol-keyed properties
            if (options.symbols)
                Object.getOwnPropertySymbols(source).forEach(copyProperty);

            //default: omit prototype's own properties
            if (options.proto)
                // Copy souce prototype's own properties into target prototype's own properties
                deepAssign(Object.assign({},options,{proto:false})) (// Prevent deeper copy of the prototype chain
                    Object.getPrototypeOf(target),
                    Object.getPrototypeOf(source)
                );

        });
        return target;
    }
}

// digestMessage
async function digestMessage(message) {
    const msgUint8 = new TextEncoder().encode(message);                           // encode as (utf-8) Uint8Array
    const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8);           // hash the message
    const hashArray = Array.from(new Uint8Array(hashBuffer));                     // convert buffer to byte array
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
    return hashHex;
}

// md5
let md5 = (function() {
    var MD5 = function (d) {
        return M(V(Y(X(d), 8 * d.length)))
    };
    function M (d) {
        for (var _, m = '0123456789abcdef', f = '', r = 0; r < d.length; r++) {
            _ = d.charCodeAt(r);
            f += m.charAt(_ >>> 4 & 15) + m.charAt(15 & _);
        }
        return f
    }
    function X (d) {
        for (var _ = Array(d.length >> 2), m = 0; m < _.length; m++) {
            _[m] = 0;
        }
        for (m = 0; m < 8 * d.length; m += 8) {
            _[m >> 5] |= (255 & d.charCodeAt(m / 8)) << m % 32;
        }
        return _
    }
    function V (d) {
        for (var _ = '', m = 0; m < 32 * d.length; m += 8) _ += String.fromCharCode(d[m >> 5] >>> m % 32 & 255);
        return _
    }
    function Y (d, _) {
        d[_ >> 5] |= 128 << _ % 32;
        d[14 + (_ + 64 >>> 9 << 4)] = _;
        for (var m = 1732584193, f = -271733879, r = -1732584194, i = 271733878, n = 0; n < d.length; n += 16) {
            var h = m;
            var t = f;
            var g = r;
            var e = i;
            f = md5ii(f = md5ii(f = md5ii(f = md5ii(f = md5hh(f = md5hh(f = md5hh(f = md5hh(f = md5gg(f = md5gg(f = md5gg(f = md5gg(f = md5ff(f = md5ff(f = md5ff(f = md5ff(f, r = md5ff(r, i = md5ff(i, m = md5ff(m, f, r, i, d[n + 0], 7, -680876936), f, r, d[n + 1], 12, -389564586), m, f, d[n + 2], 17, 606105819), i, m, d[n + 3], 22, -1044525330), r = md5ff(r, i = md5ff(i, m = md5ff(m, f, r, i, d[n + 4], 7, -176418897), f, r, d[n + 5], 12, 1200080426), m, f, d[n + 6], 17, -1473231341), i, m, d[n + 7], 22, -45705983), r = md5ff(r, i = md5ff(i, m = md5ff(m, f, r, i, d[n + 8], 7, 1770035416), f, r, d[n + 9], 12, -1958414417), m, f, d[n + 10], 17, -42063), i, m, d[n + 11], 22, -1990404162), r = md5ff(r, i = md5ff(i, m = md5ff(m, f, r, i, d[n + 12], 7, 1804603682), f, r, d[n + 13], 12, -40341101), m, f, d[n + 14], 17, -1502002290), i, m, d[n + 15], 22, 1236535329), r = md5gg(r, i = md5gg(i, m = md5gg(m, f, r, i, d[n + 1], 5, -165796510), f, r, d[n + 6], 9, -1069501632), m, f, d[n + 11], 14, 643717713), i, m, d[n + 0], 20, -373897302), r = md5gg(r, i = md5gg(i, m = md5gg(m, f, r, i, d[n + 5], 5, -701558691), f, r, d[n + 10], 9, 38016083), m, f, d[n + 15], 14, -660478335), i, m, d[n + 4], 20, -405537848), r = md5gg(r, i = md5gg(i, m = md5gg(m, f, r, i, d[n + 9], 5, 568446438), f, r, d[n + 14], 9, -1019803690), m, f, d[n + 3], 14, -187363961), i, m, d[n + 8], 20, 1163531501), r = md5gg(r, i = md5gg(i, m = md5gg(m, f, r, i, d[n + 13], 5, -1444681467), f, r, d[n + 2], 9, -51403784), m, f, d[n + 7], 14, 1735328473), i, m, d[n + 12], 20, -1926607734), r = md5hh(r, i = md5hh(i, m = md5hh(m, f, r, i, d[n + 5], 4, -378558), f, r, d[n + 8], 11, -2022574463), m, f, d[n + 11], 16, 1839030562), i, m, d[n + 14], 23, -35309556), r = md5hh(r, i = md5hh(i, m = md5hh(m, f, r, i, d[n + 1], 4, -1530992060), f, r, d[n + 4], 11, 1272893353), m, f, d[n + 7], 16, -155497632), i, m, d[n + 10], 23, -1094730640), r = md5hh(r, i = md5hh(i, m = md5hh(m, f, r, i, d[n + 13], 4, 681279174), f, r, d[n + 0], 11, -358537222), m, f, d[n + 3], 16, -722521979), i, m, d[n + 6], 23, 76029189), r = md5hh(r, i = md5hh(i, m = md5hh(m, f, r, i, d[n + 9], 4, -640364487), f, r, d[n + 12], 11, -421815835), m, f, d[n + 15], 16, 530742520), i, m, d[n + 2], 23, -995338651), r = md5ii(r, i = md5ii(i, m = md5ii(m, f, r, i, d[n + 0], 6, -198630844), f, r, d[n + 7], 10, 1126891415), m, f, d[n + 14], 15, -1416354905), i, m, d[n + 5], 21, -57434055), r = md5ii(r, i = md5ii(i, m = md5ii(m, f, r, i, d[n + 12], 6, 1700485571), f, r, d[n + 3], 10, -1894986606), m, f, d[n + 10], 15, -1051523), i, m, d[n + 1], 21, -2054922799), r = md5ii(r, i = md5ii(i, m = md5ii(m, f, r, i, d[n + 8], 6, 1873313359), f, r, d[n + 15], 10, -30611744), m, f, d[n + 6], 15, -1560198380), i, m, d[n + 13], 21, 1309151649), r = md5ii(r, i = md5ii(i, m = md5ii(m, f, r, i, d[n + 4], 6, -145523070), f, r, d[n + 11], 10, -1120210379), m, f, d[n + 2], 15, 718787259), i, m, d[n + 9], 21, -343485551);
            m = safeadd(m, h);
            f = safeadd(f, t);
            r = safeadd(r, g);
            i = safeadd(i, e);
        }
        return [m, f, r, i]
    }
    function md5cmn (d, _, m, f, r, i) {
        return safeadd(bitrol(safeadd(safeadd(_, d), safeadd(f, i)), r), m)
    }
    function md5ff (d, _, m, f, r, i, n) {
        return md5cmn(_ & m | ~_ & f, d, _, r, i, n)
    }
    function md5gg (d, _, m, f, r, i, n) {
        return md5cmn(_ & f | m & ~f, d, _, r, i, n)
    }
    function md5hh (d, _, m, f, r, i, n) {
        return md5cmn(_ ^ m ^ f, d, _, r, i, n)
    }
    function md5ii (d, _, m, f, r, i, n) {
        return md5cmn(m ^ (_ | ~f), d, _, r, i, n)
    }
    function safeadd (d, _) {
        var m = (65535 & d) + (65535 & _);
        return (d >> 16) + (_ >> 16) + (m >> 16) << 16 | 65535 & m
    }
    function bitrol (d, _) {
        return d << _ | d >>> 32 - _
    }
    function MD5Unicode(buffer){
        if (!(buffer instanceof Uint8Array)) {
            buffer = new TextEncoder().encode(typeof buffer==='string' ? buffer : JSON.stringify(buffer));
        }
        var binary = [];
        var bytes = new Uint8Array(buffer);
        for (var i = 0, il = bytes.byteLength; i < il; i++) {
            binary.push(String.fromCharCode(bytes[i]));
        }
        return MD5(binary.join(''));
    }

    return MD5Unicode;
})();

var helpers = /*#__PURE__*/Object.freeze({
	__proto__: null,
	SNEAK_MINUS_Y_MUL: SNEAK_MINUS_Y_MUL,
	MOB_EYE_HEIGHT_PERCENT: MOB_EYE_HEIGHT_PERCENT,
	CAMERA_MODE: CAMERA_MODE,
	TX_CNT: TX_CNT$4,
	lerpComplex: lerpComplex,
	Mth: Mth,
	IvanArray: IvanArray,
	VectorCollector: VectorCollector,
	Color: Color,
	Vector: Vector$1,
	Vec3: Vec3,
	MULTIPLY: MULTIPLY,
	QUAD_FLAGS: QUAD_FLAGS,
	ROTATE: ROTATE,
	NORMALS: NORMALS,
	DIRECTION: DIRECTION,
	DIRECTION_BIT: DIRECTION_BIT$1,
	DIRECTION_NAME: DIRECTION_NAME,
	Helpers: Helpers,
	SpiralGenerator: SpiralGenerator,
	Vector4: Vector4,
	AverageClockTimer: AverageClockTimer,
	FastRandom: FastRandom,
	RuneStrings: RuneStrings,
	AlphabetTexture: AlphabetTexture,
	fromMat3: fromMat3,
	calcRotateMatrix: calcRotateMatrix,
	deepAssign: deepAssign,
	digestMessage: digestMessage,
	md5: md5
});

const CHUNK_SIZE_X                   = 16;
const CHUNK_SIZE_Y                   = 40;
const CHUNK_SIZE_Z                   = 16;
const CHUNK_SIZE                     = CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z;
const CHUNK_SIZE_Y_MAX               = 4096;
const MAX_CAVES_LEVEL                = 256;
const ALLOW_NEGATIVE_Y               = true;

// Возвращает адрес чанка по глобальным абсолютным координатам
function getChunkAddr(x, y, z, v = null) {
    if(x instanceof Vector$1 || typeof x == 'object') {
        v = y;

        y = x.y;
        z = x.z;
        x = x.x;
    }
    //
    v = v || new Vector$1();
    v.x = Math.floor(x / CHUNK_SIZE_X);
    v.y = Math.floor(y / CHUNK_SIZE_Y);
    v.z = Math.floor(z / CHUNK_SIZE_Z);
    // Fix negative zero
    if(v.x == 0) {v.x = 0;}
    if(v.y == 0) {v.y = 0;}
    if(v.z == 0) {v.z = 0;}
    return v;
}

var chunk_const = /*#__PURE__*/Object.freeze({
	__proto__: null,
	CHUNK_SIZE_X: CHUNK_SIZE_X,
	CHUNK_SIZE_Y: CHUNK_SIZE_Y,
	CHUNK_SIZE_Z: CHUNK_SIZE_Z,
	CHUNK_SIZE: CHUNK_SIZE,
	CHUNK_SIZE_Y_MAX: CHUNK_SIZE_Y_MAX,
	MAX_CAVES_LEVEL: MAX_CAVES_LEVEL,
	ALLOW_NEGATIVE_Y: ALLOW_NEGATIVE_Y,
	getChunkAddr: getChunkAddr
});

class Resources {
    static async getModelAsset(key) {
        if (!this.models[key]) {
            return;
        }

        const entry = this.models[key];

        if (entry.asset) {
            return entry.asset;
        }

        let asset;

        if (entry.type == 'json') {
            asset = Resources.loadJsonModel(entry, key, entry.baseUrl);
        }

        return entry.asset = asset;
    }

    static onLoading = (state) => {};

    /**
     * @param settings
     * @param settings.glsl need glsl
     * @param settings.wgsl need wgls for webgpu
     * @param settings.imageBitmap return imageBitmap for image instead of Image
     * @returns {Promise<void>}
     */
    static load(settings) {
        this.shaderBlocks       = {};
        this.codeMain           = {};
        this.codeSky            = {};
        this.pickat             = {};
        // this.sky                = {};
        this.clouds             = {};
        this.inventory          = {};
        this.physics            = {};
        this.models             = {};
        this.sounds             = {};
        this.sound_sprite_main  = {};

        // Functions
        const loadTextFile = Resources.loadTextFile;
        const loadImage = (url) => Resources.loadImage(url, settings.imageBitmap);
        
        let all = [];

        // Others
        all.push(loadImage('media/pickat_target.png').then((img) => { this.pickat.target = img;}));
        all.push(loadImage('media/debug_frame.png').then((img) => { this.pickat.debug = img;}));
        all.push(fetch('/data/sounds.json').then(response => response.json()).then(json => { this.sounds = json;}));
        all.push(fetch('/sounds/main/sprite.json').then(response => response.json()).then(json => { this.sound_sprite_main = json;}));

        // Skybox textures
        /*
        let skiybox_dir = './media/skybox/park';
        all.push(loadImage(skiybox_dir + '/posx.webp').then((img) => {this.sky.posx = img}));
        all.push(loadImage(skiybox_dir + '/negx.webp').then((img) => {this.sky.negx = img}));
        all.push(loadImage(skiybox_dir + '/posy.webp').then((img) => {this.sky.posy = img}));
        all.push(loadImage(skiybox_dir + '/negy.webp').then((img) => {this.sky.negy = img}));
        all.push(loadImage(skiybox_dir + '/posz.webp').then((img) => {this.sky.posz = img}));
        all.push(loadImage(skiybox_dir + '/negz.webp').then((img) => {this.sky.negz = img}));
        */

        // Skybox shaders
        if (settings.wgsl) {
            all.push(loadTextFile('./shaders/skybox_gpu/shader.wgsl').then((txt) => { this.codeSky = { vertex: txt, fragment: txt}; } ));
        } else {
            all.push(loadTextFile('./shaders/skybox/vertex.glsl').then((txt) => { this.codeSky.vertex = txt; } ));
            all.push(loadTextFile('./shaders/skybox/fragment.glsl').then((txt) => { this.codeSky.fragment = txt; } ));
        }

        // Shader blocks

        if (settings.wgsl) {
            // not supported 
        } else {
            all.push(
                loadTextFile('./shaders/shader.blocks.glsl')
                    .then(text => Resources.parseShaderBlocks(text, this.shaderBlocks))
                    .then(blocks => {
                        console.debug('Load shader blocks:', blocks);
                    })
            );
        }

        // Painting
        all.push[Resources.loadPainting()];

        // Physics features
        all.push(fetch('/vendors/prismarine-physics/lib/features.json').then(response => response.json()).then(json => { this.physics.features = json;}));

        // Clouds texture
        all.push(loadImage('/media/clouds.png').then((image1) => {
            let canvas          = document.createElement('canvas');
            canvas.width        = 256;
            canvas.height       = 256;
            let ctx             = canvas.getContext('2d');
            ctx.drawImage(image1, 0, 0, 256, 256, 0, 0, 256, 256);
            this.clouds.texture = ctx.getImageData(0, 0, 256, 256);
        }));

        // Mob & player models
        all.push(
            Resources.loadJsonDatabase('/media/models/database.json', '/media/models/')
                .then((t) => Object.assign(this.models, t.assets))
                .then((loaded) => {
                    console.debug("Loaded models:", loaded);
                })
        );

        // Loading progress calculator
        let d = 0;
        this.progress = {
            loaded:     0,
            total:      all.length,
            percent:    0
        };
        for (const p of all) {
            p.then(()=> {    
                d ++;
                this.progress.loaded = d;
                this.progress.percent = (d * 100) / all.length;
                this.onLoading({...this.progress});
            });
          }

        // TODO: add retry
        return Promise.all(all);

    }

    /**
     * Parse shader.blocks file defenition
     * @param {string} text 
     * @param {{[key: string]: string}} blocks
     */
    static async parseShaderBlocks(text, blocks = {}) {
        const blocksStart = '#ifdef';
        const blocksEnd = '#endif';

        let start = text.indexOf(blocksStart);
        let end = start;

        while(start > -1) {
            end = text.indexOf(blocksEnd, start);

            if (end === -1) {
                throw new TypeError('Shader block has unclosed ifdef statement at:' + start + '\n\n' + text);
            }

            const block = text.substring(start  + blocksStart.length, end);
            const lines = block.split('\n');
            const name = lines.shift().trim();

            const source = lines.map((e) => {
                return e.startsWith('    ') // remove first tab (4 space)
                    ? e.substring(4).trimEnd() 
                    : e.trimEnd();
            }).join('\n');

            blocks[name] = source.trim();

            start = text.indexOf(blocksStart, start + blocksStart.length);
        }

        return blocks;
    }

    //
    static async loadWebGLShaders(vertex, fragment) {
        let all = [];
        let resp = {
            code: {
                vertex: null,
                fragment: null
            }
        };
        all.push(Resources.loadTextFile(vertex).then((txt) => { resp.code.vertex = txt; } ));
        all.push(Resources.loadTextFile(fragment).then((txt) => { resp.code.fragment = txt; } ));
        await Promise.all(all);
        return resp;
    }

    //
    static async loadWebGPUShader(shader_uri) {
        let all = [];
        let resp = {
            code: {
                vertex: null,
                fragment: null
            }
        };
        all.push(Resources.loadTextFile(shader_uri).then((txt) => { resp.code.vertex = txt; resp.code.fragment = txt;}));
        await Promise.all(all);
        return resp;
    }

    static loadTextFile(url, json = false) {
        return fetch(url).then(response => json ? response.json() : response.text());
    }
    
    static loadImage(url,  imageBitmap) {
        if (imageBitmap) {
            return fetch(url)
                .then(r => r.blob())
                .then(blob => self.createImageBitmap(blob, {premultiplyAlpha: 'none'}))
                .catch((e) => {
                    vt.error('Error loadImage in resources');
                    setTimeout(() => {
                        location.reload();
                    }, 1000);
                });
        }
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = function () {
                resolve(image);
            };
            image.onError = function () {
                reject();
            };
            image.src = url;
        })
    }

    static unrollGltf(primitive, gltf, target = []) {
        const data = target;
        const {
            NORMAL, POSITION, TEXCOORD_0
        } = primitive.attributes;
        const posData = new Float32Array(POSITION.bufferView.data);
        const normData = new Float32Array(NORMAL.bufferView.data);
        const uvData = new Float32Array(TEXCOORD_0.bufferView.data);
        if (typeof primitive.indices === 'number') {
                const indices = gltf.accessors[primitive.indices];
                const i16 = new Uint16Array(indices.bufferView.data, primitive.indicesOffset, primitive.indicesLength);
                for(let i = 0; i < i16.length; i ++) {
                    let index = i16[i];
                    data.push(
                        posData[index * POSITION.size + 0],
                        posData[index * POSITION.size + 1],
                        posData[index * POSITION.size + 2],
                        uvData[index * TEXCOORD_0.size + 0],
                        uvData[index * TEXCOORD_0.size + 1],
                        0, 0, 0, 0,
                        normData[index * NORMAL.size + 0],
                        normData[index * NORMAL.size + 1],
                        normData[index * NORMAL.size + 2],
                    );
                }
        }
        return data;
    }

    static async loadJsonModel(dataModel, key, baseUrl) {
        const asset = await Resources.loadTextFile(baseUrl + dataModel.geom, true);
    
        asset.type = dataModel.type;
        asset.source = dataModel;
        asset.key = key;
        asset.skins = Object.fromEntries(Object.entries(dataModel.skins).map((e) => [e[0], null]));

        asset.getSkin = async (id) => {
            if (!dataModel.skins[id]) {
                return null;
            }

            if (asset.skins[id]) {
                return asset.skins[id];
            }

            const image = Resources
                .loadImage(baseUrl + dataModel.skins[id], !!self.createImageBitmap);

            return asset.skins[id] = image;
        };
    
        return asset;
    }

    static async loadJsonDatabase(url, baseUrl) {
        const base = await Resources.loadTextFile(url, true);
        base.baseUrl = baseUrl;

        for(let key in base.assets) {
            base.assets[key].baseUrl = baseUrl;
        }
        return base;
    }

    // loadResourcePacks...
    static async loadResourcePacks(settings) {
        const resource_packs_url = (settings && settings.resource_packs_url) ? settings.resource_packs_url : '../data/resource_packs.json';
        return Helpers.fetchJSON(resource_packs_url, true, 'rp');
    }

    // Load supported block styles
    static async loadBlockStyles(settings) {
        let resp = new Set();
        let all = [];
        let json_url = (settings && settings.json_url) ? settings.json_url : '../data/block_style.json';
        
        await Helpers.fetchJSON(json_url, true, 'bs').then((json) => {
            for(let code of json) {
                // Load module
                /*
                all.push(import('./block_style/' + code + '.js').then(module => {
                    resp.add(module.default);
                }));*/
               
                switch (code) {
                    case 'azalea':
                        all.push( Promise.resolve().then(function () { return azalea; }).then(module => {
                            resp.add(module.default);
                        }));
                        break;   
                    case 'bamboo':
                        all.push( Promise.resolve().then(function () { return bamboo; }).then(module => {
                            resp.add(module.default);
                        }));
                        break;  
                    case 'bed':
                        all.push(Promise.resolve().then(function () { return bed; }).then(module => {
                            resp.add(module.default);
                        }));
                        break;   
                    case 'cake':
                        all.push(Promise.resolve().then(function () { return cake; }).then(module => {
                            resp.add(module.default);
                        }));
                        break;
                    case 'campfire':
                        all.push(Promise.resolve().then(function () { return campfire; }).then(module => {
                            resp.add(module.default);
                        }));
                        break;   
                    case 'cocoa':
                        all.push(Promise.resolve().then(function () { return cocoa; }).then(module => {resp.add(module.default);}));
                        break;
                    case 'cube':
                        all.push(Promise.resolve().then(function () { return cube; }).then(module => {resp.add(module.default);}));
                        break;
                    case 'door':
                        all.push(Promise.resolve().then(function () { return door; }).then(module => {resp.add(module.default);}));
                        break; 
                    case 'extruder':
                        all.push(Promise.resolve().then(function () { return extruder; }).then(module => {resp.add(module.default);}));
                        break;
                    case 'fence':
                        all.push(Promise.resolve().then(function () { return fence; }).then(module => {resp.add(module.default);}));
                        break;
                    case 'ladder':
                        all.push(Promise.resolve().then(function () { return ladder; }).then(module => {resp.add(module.default);}));
                        break;
                    case 'lantern':
                        all.push(Promise.resolve().then(function () { return lantern; }).then(module => {resp.add(module.default);}));
                        break;
                   /* case 'painting':
                        import('./block_style/painting.js').then(module => {resp.add(module.default);})
                        break;  */
                    case 'pane':
                        all.push(Promise.resolve().then(function () { return pane; }).then(module => {resp.add(module.default);}));
                        break;
                    case 'plane':
                        all.push(Promise.resolve().then(function () { return plane; }).then(module => {resp.add(module.default);}));
                        break;
                    case 'planting':
                        all.push(Promise.resolve().then(function () { return planting; }).then(module => {resp.add(module.default);}));
                        break;
                    case 'pot':
                        all.push(Promise.resolve().then(function () { return pot; }).then(module => {resp.add(module.default);}));
                        break;
                    case 'redstone':
                        all.push( Promise.resolve().then(function () { return redstone; }).then(module => {resp.add(module.default);}));
                        break;
                    case 'sign':
                        all.push(Promise.resolve().then(function () { return sign; }).then(module => {resp.add(module.default);}));
                        break;
                    case 'stairs':
                        all.push(Promise.resolve().then(function () { return stairs; }).then(module => {resp.add(module.default);}));
                        break;
                    case 'text':
                        all.push(Promise.resolve().then(function () { return text; }).then(module => {resp.add(module.default);}));
                        break;
                    case 'thin':
                        all.push(Promise.resolve().then(function () { return thin; }).then(module => {resp.add(module.default);}));
                        break;
                    case 'torch':
                        all.push(Promise.resolve().then(function () { return torch; }).then(module => {resp.add(module.default);}));
                        break;
                    case 'trapdoor':
                        all.push(Promise.resolve().then(function () { return trapdoor; }).then(module => {resp.add(module.default);}));
                        break;
                    case 'triangle':
                        all.push(Promise.resolve().then(function () { return triangle; }).then(module => {resp.add(module.default);}));
                        break;
                    case 'wall':
                        all.push(Promise.resolve().then(function () { return wall; }).then(module => {resp.add(module.default);}));
                        break;
                    case 'default':
                        all.push(Promise.resolve().then(function () { return _default; }).then(module => {resp.add(module.default);}));
                        break;
                        /*
                    default:
                        all.push(import('./block_style/' + code + '.js').then(module => {
                            resp.add(module.default);
                        }));
                        break;*/
                
            }
        }
        });
        await Promise.all(all).then(() => { return this; });
        return resp;
    }

  
    // Load skins
    static async loadSkins() {
        let resp = null;
        await Helpers.fetchJSON('../data/skins.json').then(json => {
            for(let item of json) {
                item.file = './media/models/player_skins/' + item.id + '.png';
                item.preview = './media/skins/preview/' + item.id + '.png';
            }
            resp = json;
        });
        return resp;
    }

    // Load recipes
    static async loadRecipes() {
        return  Helpers.fetchJSON('../data/recipes.json', true);
    }

    // Load models
    static async loadModels() {
        return  Helpers.fetchJSON('../media/models/database.json');
    }

    // Load materials
    static async loadMaterials() {
        return  Helpers.fetchJSON('../data/materials.json', true);
    }

    // Load painting
    static async loadPainting() {
        if(Resources._painting) {
            return Resources._painting;
        }
        let resp = null;
        await Helpers.fetchJSON('../data/painting.json').then(json => {
            json.sizes = new Map();
            for(const [k, item] of Object.entries(json.frames)) {
                let sz_w = item.w / json.one_width;
                let sz_h = item.h / json.one_height;
                item.x /= json.sprite_width;
                item.y /= json.sprite_height;
                item.w /= json.sprite_width;
                item.h /= json.sprite_height;
                const key = `${sz_w}x${sz_h}`;
                if(!json.sizes.has(key)) {
                    json.sizes.set(key, new Map());
                }
                json.sizes.get(key).set(k, item);
            }
            resp = json;
        });
        return Resources._painting = resp;
    }

    // Load music discs
    static async loadMusicDiscs() {
        if(Resources._music_discs) {
            return Resources._music_discs;
        }
        let resp = null;
        await Helpers.fetchJSON('../data/music_disc.json').then(json => {
            resp = json;
        });
        return Resources._music_discs = resp;
    }

}

class TerrainTextureUniforms {
    constructor() {
        this.blockSize = 16.0;
        this.pixelSize = 1.0 / 512.0;
        this.mipmap = 0;
    }
}

TerrainTextureUniforms.default = new TerrainTextureUniforms();

let tmpCanvas;

class BaseResourcePack {

    constructor(BLOCK, location, id) {
        this.BLOCK = BLOCK;
        this.id = id;
        this.dir = location;
        this.textures = new Map();
        this.materials = new Map();

        this.manager = null;
        this.shader = null;
        this.styles_stat = new Map();
    }

    async init(manager) {
        this.manager = manager;

        let dir = this.dir;

        return Promise.all([
            Helpers.fetchJSON(dir + '/conf.json', true, 'rp'),
            Helpers.fetchJSON(dir + '/blocks.json', true, 'rp')
        ]).then(async ([conf, json]) => {
            this.conf = conf;
            for(let b of json) {
                await this.BLOCK.add(this, b);
            }
        })
    }

    async initShaders(renderBackend, shared = false) {
        if (this.shader) {
            this.shader.shared = shared;
            return this.shader;
        }

        let shader_options = null;

        if (!this.conf.shader || this.conf.shader.extends) {
            const pack = this.manager.list.get(this.conf.shader?.extends || 'base');

            if (pack) {
                return this.shader = await pack.initShaders(renderBackend, true);
            }
        }

        if('gl' in renderBackend) {
            shader_options = this.conf.shader.webgl;
            shader_options = {
                vertex : this.dir + shader_options.vertex,
                fragment : this.dir + shader_options.fragment
            };
        } else {
            shader_options = this.dir + this.conf.shader.webgpu;
        }

        this.shader = await renderBackend.createResourcePackShader(shader_options);
        this.shader.resource_pack_id = this.id;
        this.shader.shared = shared;

        return this.shader;
    }

    async _loadTexture (url, settings, renderBackend) {
        const image = await Resources.loadImage(url, true);

        const texture = renderBackend.createTexture({
            source: await this.genMipMapTexture(image, settings),
            style: this.genTextureStyle(image, settings),
            minFilter: 'nearest',
            magFilter: 'nearest',
        });

        return {
            image, texture
        }
    }

    async _processTexture (textureInfo, renderBackend, settings) {

        let image, texture;

        if('canvas' in textureInfo) {
            const cnv = textureInfo.canvas;
            cnv.canvas = document.createElement('canvas');
            cnv.canvas.width = cnv.width;
            cnv.canvas.height = cnv.height;
            cnv.ctx = cnv.canvas.getContext('2d');

            // Fill magenta background
            // cnv.ctx.fillStyle = '#ff0088';
            // cnv.ctx.imageSmoothingEnabled = false;
            // cnv.ctx.fillRect(0, 0, 200, 200);

            // demo text
            cnv.ctx.fillStyle = '#ffffffff';
            cnv.ctx.textBaseline = 'top';
            const char_size = {
                width: cnv.width / textureInfo.tx_cnt,
                height: cnv.height / textureInfo.tx_cnt
            };
            AlphabetTexture.init();
            for(let [_, item] of AlphabetTexture.chars.entries()) {
                const char = item.char;
                let py = 0;
                if(char.length > 1) {
                    cnv.ctx.font = '18px UbuntuMono-Regular';
                    py = 7;
                } else {
                    cnv.ctx.font = '31px UbuntuMono-Regular';
                    py = 1;
                }
                const mt = cnv.ctx.measureText(char);
                cnv.ctx.fillText(char, item.x + 16-mt.width/2, item.y+py);
            }

            // Helpers.downloadImage(cnv.canvas, 'alphabet.png');

            const settings_for_canvas = {...settings};
            settings_for_canvas.mipmap = false;

            const texture = renderBackend.createTexture({
                source: cnv.canvas,
                style: this.genTextureStyle(cnv.canvas, settings_for_canvas),
                minFilter: 'nearest',
                magFilter: 'nearest',
            });

            textureInfo.texture = texture;
            textureInfo.width   = cnv.width;
            textureInfo.height  = cnv.height;
            textureInfo.texture_n = null;
            // textureInfo.imageData = cnv.ctx.getImageData(0, 0, cnv.width, cnv.height);

            return;

        } else {
            let resp = await this._loadTexture(
                this.dir + textureInfo.image,
                settings,
                renderBackend
            );
            image = resp.image;
            texture = resp.texture;
        }

        textureInfo.texture = texture;
        textureInfo.width   = image.width;
        textureInfo.height  = image.height;
        textureInfo.texture_n = null;

        // Get image bytes
        const canvas        = tmpCanvas;
        const ctx           = canvas.getContext('2d');

        canvas.width        = image.width;
        canvas.height       = image.height;

        ctx.drawImage(
            image, 0, 0,
            image.width,
            image.height, 0, 0,
            image.width, image.height
        );

        textureInfo.imageData = ctx.getImageData(0, 0, image.width, image.height);
        textureInfo.getColorAt = function(x, y) {
            const ax = (x * this.width) | 0;
            const ay = (y * this.height) | 0;
            const index = ((ay * this.width) + ax) * 4;
            return new Color(
                this.imageData.data[index + 0],
                this.imageData.data[index + 1],
                this.imageData.data[index + 2],
                this.imageData.data[index + 3]
            );
        };

        canvas.width = canvas.height = 0;

        if ('image_n' in textureInfo) {
            const { texture } = await this._loadTexture(
                this.dir + textureInfo.image_n,
                settings,
                renderBackend
            );

            textureInfo.texture_n = texture;
        }
    }

    async initTextures(renderBackend, settings) {
        if (!this.conf.textures) {
            return;
        }

        const tasks = [];

        tmpCanvas = tmpCanvas || document.createElement('canvas');

        for(let [k, v] of Object.entries(this.conf.textures)) {
            tasks.push(this._processTexture(v, renderBackend, settings));

            this.textures.set(k, v);
        }

        return Promise.all(tasks)
    }

    genTextureStyle(image, settings) {
        let terrainTexSize          = image.width;
        let terrainBlockSize        = image.width / 512 * 16;
        const style = new TerrainTextureUniforms();
        style.blockSize = terrainBlockSize / terrainTexSize;
        style.pixelSize = 1.0 / terrainTexSize;
        style.mipmap = settings.mipmap ? 4.0 : 0.0;
        return style;
    }

    //
    getMaterial(key) {
        let texMat = this.materials.get(key);
        if(texMat) {
            return texMat;
        }
        let key_arr = key.split('/');
        let group = key_arr[1];
        let texture_id = key_arr[2];
        let mat = this.shader.materials[group];
        texMat = mat.getSubMat(this.getTexture(texture_id).texture);
        this.materials.set(key, texMat);
        return texMat;
    }

    //
    async genMipMapTexture(image, settings) {
        if (!settings.mipmap) {
            if (image instanceof  self.ImageBitmap) {
                return  image;
            }
            return await self.createImageBitmap(image, {premultiplyAlpha: 'none'});
        }
        const canvas2d = document.createElement('canvas');
        const context = canvas2d.getContext('2d');
        const w = image.width;
        canvas2d.width = w * 2;
        canvas2d.height = w * 2;
        let offset = 0;
        context.drawImage(image, 0, 0);
        for (let dd = 2; dd <= 16; dd *= 2) {
            const nextOffset = offset + w * 2 / dd;
            context.drawImage(canvas2d, offset, 0, w * 2 / dd, w, nextOffset, 0, w / dd, w);
            offset = nextOffset;
        }
        offset = 0;
        for (let dd = 2; dd <= 16; dd *= 2) {
            const nextOffset = offset + w * 2 / dd;
            context.drawImage(canvas2d, 0, offset, w * 2, w * 2 / dd, 0, nextOffset, w * 2, w / dd);
            offset = nextOffset;
        }
        // canvas2d.width = 0;
        // canvas2d.height = 0;
        // return await self.createImageBitmap(canvas2d);
        /*
            var link = document.createElement('a');
            link.download = 'filename.png';
            link.href = canvas2d.toDataURL()
            link.click();
        */
        return canvas2d;
    }

    getTexture(id) {
        return this.textures.get(id);
    }

    // pushVertices
    pushVertices(vertices, block, world, pos, neighbours, biome, dirt_color, draw_style, force_tex, _matrix, _pivot) {
        const style = draw_style ? draw_style : block.material.style;
        const module = this.BLOCK.styles.get(style);
        if(!module) {
            throw 'Invalid vertices style `' + style + '`';
        }

        /*
        // stat
        let stat = this.styles_stat.get(style);
        if(!stat) {
            stat = {count: 0, time: 0}
            this.styles_stat.set(style, stat);
        }*/

        // let p = performance.now();
        const resp = module.func(block, vertices, world, pos.x, pos.y, pos.z, neighbours, biome, dirt_color, true, _matrix, _pivot, force_tex);
        // stat.count++;
        // stat.time += (performance.now() - p);

        return resp;
    }

}

const START_WOOL_ID = 350; // ... 365
const START_CARPET_ID = 800; // ... 815
const START_BUTTON_ID = 770; // ...799
const START_BED_ID = 1200; // ...1215
const START_TERRACOTTA = 1300; // 1315
const START_GLAZED_TERRACOTTA = 1400; // 1415
let BLOCK$2 = null;

const COLOR_PALETTE = {
    white: [0, 0],      // Белая керамика - white_terracotta
    orange: [2, 1],     // Оранжевая керамика - orange_terracotta
    magenta: [2, 3],    // Сиреневая керамика - magenta_terracotta
    light_blue: [3, 2], // Светло-синяя керамика - light_blue_terracotta
    yellow: [3, 1],     // Жёлтая керамика - yellow_terracotta
    lime: [0, 2],       // Лаймовая керамика - lime_terracotta
    pink: [3, 3],       // Розовая керамика - pink_terracotta
    gray: [2, 0],       // Серая керамика - gray_terracotta
    light_gray: [1, 0], // Светло-серая керамика - light_gray_terracotta
    cyan: [2, 2],       // Бирюзовая керамика - cyan_terracotta
    purple: [1, 3],     // Фиолетовая керамика - purple_terracotta
    blue: [0, 3],       // Синяя керамика - blue_terracotta
    brown: [0, 1],      // Коричневая керамика - brown_terracotta
    green: [1, 2],      // Зелёная керамика - green_terracotta
    red: [1, 1],        // Красная керамика - red_terracotta
    black: [3, 0],      // Чёрная керамика - black_terracotta
};

class ResourcePackManager {

    // constructor
    constructor(BLOCK) {
        this.list = new Map();
        this.BLOCK = BLOCK;
    }

    // init
    async init(settings) {
        const json              = await Resources.loadResourcePacks(settings);
        const def_resource_pack = json.base;
        const resource_packs    = new Set();
        const all               = [];

        // 1. base
        const base = new BaseResourcePack(this.BLOCK, def_resource_pack.path, def_resource_pack.id);
        resource_packs.add(base);

        // 2. extends
        for(let item of json.extends) {
            resource_packs.add(new BaseResourcePack(this.BLOCK, item.path, item.id));
        }

        // 3. variants
        const selected_variant_id = settings ? settings.texture_pack : null;

        if(settings?.texture_pack != def_resource_pack.id) {
            for(let item of json.variants) {
                if(!selected_variant_id || item.id == selected_variant_id) {
                    resource_packs.add(new BaseResourcePack(this.BLOCK, item.path, item.id));
                }
            }
        }

        // Load Resourse packs (blocks)
        for(let rp of resource_packs.values()) {
            this.list.set(rp.id, rp);
            await rp.init(this);
        }

        this.initWool(base);
        this.initCarpets(base);
        this.initButtons(base);
        this.initBed(base);
        this.initTerracotta(base);
        this.initGlazedTerracotta(base);

        // Load music discs
        for(let disc of await Resources.loadMusicDiscs()) {
            const b = {
                "id": disc.id,
                "name": "MUSIC_DISC_" + (disc.id - 900),
                "title": disc.title,
                "style": "extruder",
                "item": {"name": "music_disc"},
                "max_in_stack": 1,
                "material": {"id": "iron"},
                "texture": {"side": [0, 29]}
            };
            this.BLOCK.add(base, b);
        }

    }

    // Buttons
    initButtons(resource_pack) {
        let i = 0;
        const { BLOCK } = this;
        const materials = [
            BLOCK.OAK_PLANK,
            BLOCK.BIRCH_PLANK,
            BLOCK.SPRUCE_PLANK,
            BLOCK.ACACIA_PLANK,
            BLOCK.JUNGLE_PLANK,
            BLOCK.DARK_OAK_PLANK,
            BLOCK.WARPED_PLANK,
            BLOCK.CONCRETE
        ];
        for(let mat of materials) {
            let name_prefix = mat.name.replace('_PLANK', '');
            const b = {
                "id": START_BUTTON_ID + i,
                "name": name_prefix + '_BUTTON',
                "material": mat.material,
                "sound": mat.sound,
                "texture": mat.texture,
                "width": 0.375,
                "height": 0.125,
                "depth": 0.25,
                "can_rotate": true,
                "transparent": true,
                "extra_data": {pressed: 0},
                "tags": [
                    "no_drop_ao",
                    "rotate_by_pos_n",
                    "button"
                ]
            };
            this.BLOCK.add(resource_pack, b);
            i++;
        }
    }

    // Wools
    initWool(resource_pack) {
        const palette_pos = {x: 24, y: 31};
        let i = 0;
        for(let color in COLOR_PALETTE) {
            const color_pos = COLOR_PALETTE[color];
            const mask_color = new Color(color_pos[0], color_pos[1], 0, 1);
            const TX_CNT = 32;
            mask_color.r = (palette_pos.x + 0.25 * mask_color.r + 0.125) / TX_CNT;
            mask_color.g = (palette_pos.y + 0.25 * mask_color.g + 0.125) / TX_CNT;
            const b = {
                "id": START_WOOL_ID + i,
                "name": color.toUpperCase() + '_WOOL',
                "material": {"id": "wool"},
                "sound": "madcraft:block.cloth",
                "texture": {"side": [10, 17]},
                "mask_color": mask_color,
                "tags": [
                    "can_put_info_pot",
                    "mask_color"
                ]
            };
            this.BLOCK.add(resource_pack, b);
            i++;
        }
    }

    // Beds
    initBed(resource_pack) {
        const palette_pos = {x: 24, y: 31};
        let i = 0;
        for(let color in COLOR_PALETTE) {
            const color_pos = COLOR_PALETTE[color];
            const mask_color = new Color(color_pos[0], color_pos[1], 0, 1);
            const TX_CNT = 32;
            mask_color.r = (palette_pos.x + 0.25 * mask_color.r + 0.125) / TX_CNT;
            mask_color.g = (palette_pos.y + 0.25 * mask_color.g + 0.125) / TX_CNT;
            const b = {
                "id": START_BED_ID + i,
                "name": color.toUpperCase() + '_BED',
                "material": {"id": "wood"},
                "style": "bed",
                "height": 0.5,
                "max_in_stack": 1,
                "sound": "madcraft:block.wood",
                "transparent": true,
                "texture": {
                    "side": [16, 23]
                },
                "can_rotate": true,
                "inventory": {
                    "style": "extruder",
                    "texture": [4, 17]
                },
                "mask_color": mask_color,
                "tags": [
                    "bed",
                    "rotate_by_pos_n",
                    "mask_color"
                ]
            };
            this.BLOCK.add(resource_pack, b);
            i++;
        }
    }

    // Терракота (terracotta)
    initTerracotta(resource_pack) {
        const palette_pos = {x: 24, y: 31};
        let i = 0;
        for(let color in COLOR_PALETTE) {
            const color_pos = COLOR_PALETTE[color];
            const mask_color = new Color(color_pos[0], color_pos[1], 0, 1);
            const TX_CNT = 32;
            mask_color.r = (palette_pos.x + 0.25 * mask_color.r + 0.125) / TX_CNT;
            mask_color.g = (palette_pos.y + 0.25 * mask_color.g + 0.125) / TX_CNT;
            const b = {
                "id": START_TERRACOTTA + i,
                "name": color.toUpperCase() + '_TERRACOTTA',
                "material": {"id": "stone"},
                "sound": "madcraft:block.stone",
                "texture": {"side": [10, 16]},
                "mask_color": mask_color,
                "tags": [
                    "can_put_info_pot",
                    "mask_color"
                ]
            };
            this.BLOCK.add(resource_pack, b);
            i++;
        }
    }

    // Glazed terracotta
    initGlazedTerracotta(resource_pack) {
        const first_pos = {x: 29, y: 6};
        let i = 0;
        for(let color in COLOR_PALETTE) {
            const b = {
                "id": START_GLAZED_TERRACOTTA + i,
                "name": color.toUpperCase() + '_GLAZED_TERRACOTTA',
                "material": {"id": "stone"},
                "sound": "madcraft:block.stone",
                "uvlock": false,
                "texture": {
                    "side": [first_pos.x, first_pos.y + i],
                    "up": [first_pos.x + 1, first_pos.y + i, 0],
                    "north": [first_pos.x + 1, first_pos.y + i, 0],
                    "south": [first_pos.x + 1, first_pos.y + i, 3],
                    "west": [first_pos.x, first_pos.y + i, 3]
                },
                "can_rotate": true,
                "tags": [
                    "can_put_info_pot"
                ]
            };
            this.BLOCK.add(resource_pack, b);
            i++;
        }
    }

    // Carpets
    initCarpets(resource_pack) {
        const palette_pos = {x: 24, y: 31};
        let i = 0;
        for(let color in COLOR_PALETTE) {
            const color_pos = COLOR_PALETTE[color];
            const mask_color = new Color(color_pos[0], color_pos[1], 0);
            const TX_CNT = 32;
            mask_color.r = (palette_pos.x + 0.25 * mask_color.r + 0.125) / TX_CNT;
            mask_color.g = (palette_pos.y + 0.25 * mask_color.g + 0.125) / TX_CNT;
            const b = {
                "id": START_CARPET_ID + i,
                "transparent": true,
                "height": 1/16,
                "can_rotate": true,
                "name": color.toUpperCase() + '_CARPET',
                "material": {"id": "wool"},
                "sound": "madcraft:block.cloth",
                "texture": {"side": [10, 17]},
                "mask_color": mask_color,
                "tags": [
                    "mask_color",
                    "rotate_by_pos_n",
                    "no_drop_ao"
                ]
            };
            this.BLOCK.add(resource_pack, b);
            i++;
        }
    }

    get(id) {
        return this.list.get(id);
    }

    // registerResourcePack
    async registerResourcePack(rp) {
        this.list.set(rp.id, rp);

        await rp.init(this);

        return this;
    }

    // Init shaders for all resource packs
    async initShaders(renderBackend) {
        for (let value of this.list.values()) {
            await value.initShaders(renderBackend);
        }
    }

    // Init textures
    async initTextures(renderBackend, options) {
        const tasks = [];

        for (let value of this.list.values()) {
            tasks.push(value.initTextures(renderBackend, options));
        }

        return Promise.all(tasks);
    }
}

const {mat3: mat3$3, mat4: mat4$b, vec3}      = glMatrix$1;
const defaultPivot$2      = [0.5, 0.5, 0.5];
const defalutCenter     = [0, 0, 0];
const defaultMatrix$2     = mat4$b.create();
const tempMatrix$1        = mat3$3.create();

const PLANES = {
    up: {
        // axisX , axisY. axisY is flips sign!
        axes  : [[1, 0, 0], /**/ [0, 1, 0]],
        flip  : [1, 1],
        // origin offset realtive center
        offset : [0.5, 0.5, 1.0],
    },
    down: {
        axes  : [[1, 0, 0], /**/ [0, -1, 0]],
        flip  : [-1, -1],
        offset: [0.5, 0.5, 0.0],
    },
    south: {
        axes  : [[1, 0, 0], /**/ [0, 0, 1]],
        flip  : [1, 1],
        offset: [0.5, 0.0, 0.5],
    },
    north: {
        axes  : [[1, 0, 0], /**/ [0, 0, -1]],
        flip  : [-1, 1],
        offset: [0.5, 1.0, 0.5],
    },
    east: {
        axes  : [[0, 1, 0], /**/ [0, 0, 1]],
        flip  : [1, 1],
        offset: [1.0, 0.5, 0.5],
    },
    west: {
        axes  : [[0, 1, 0], /**/ [0, 0, -1]],
        flip  : [-1, 1],
        offset: [-0.0, 0.5, 0.5],
    }
};

class AABB {

    constructor() {
        this.x_min = 0;
        this.y_min = 0;
        this.z_min = 0;
        this.x_max = 0;
        this.y_max = 0;
        this.z_max = 0;
    }

    /**
     * @type {Vector}
     */
    get size() {
        this._size = this._size || new Vector$1(0,0,0);

        this._size.x = this.width;
        this._size.y = this.height;
        this._size.z = this.depth;

        return this._size;
    }

    get width() {
        return this.x_max - this.x_min;
    }

    get height() {
        return this.y_max - this.y_min;
    }

    get depth() {
        return this.z_max - this.z_min;
    }

    get center() {
        this._center = this._center ||  new Vector$1(0,0,0);
        this._center.set(
            this.x_min + this.width / 2,
            this.y_min + this.height / 2,
            this.z_min + this.depth / 2,
        );

        return this._center;
    }

    clone() {
        return new AABB().copyFrom(this);
    }

    copyFrom(aabb) {
        this.x_min = aabb.x_min;
        this.x_max = aabb.x_max;
        this.y_min = aabb.y_min;
        this.y_max = aabb.y_max;
        this.z_min = aabb.z_min;
        this.z_max = aabb.z_max;
        return this;
    }

    pad(padding) {
        this.x_min -= padding;
        this.x_max += padding;
        this.y_min -= padding;
        this.y_max += padding;
        this.z_min -= padding;
        this.z_max += padding;
        return this;
    }

    set(xMin, yMin, zMin, xMax, yMax, zMax) {
        this.x_min = xMin;
        this.y_min = yMin;
        this.z_min = zMin;
        this.x_max = xMax;
        this.y_max = yMax;
        this.z_max = zMax;
        return this;
    }

    setIntersect(aabb1, aabb2) {
        this.x_min = Math.max(aabb1.x_min, aabb2.x_min);
        this.x_max = Math.min(aabb1.x_max, aabb2.x_max);
        this.y_min = Math.max(aabb1.y_min, aabb2.y_min);
        this.y_max = Math.min(aabb1.y_max, aabb2.y_max);
        this.z_min = Math.max(aabb1.z_min, aabb2.z_min);
        this.z_max = Math.min(aabb1.z_max, aabb2.z_max);
        return this;
    }

    isEmpty() {
        return this.x_min >= this.x_max && this.y_min >= this.y_max && this.z_min >= this.z_max;
    }

    applyMatrix(matrix, pivot) {
        if (pivot) {
            this.x_min -= pivot.x;
            this.y_min -= pivot.y;
            this.z_min -= pivot.z;
            this.x_max -= pivot.x;
            this.y_max -= pivot.y;
            this.z_max -= pivot.z;
        }

        const x0 = this.x_min * matrix[0] + this.y_min * matrix[1] + this.z_min * matrix[2];
        const x1 = this.x_max * matrix[0] + this.y_max * matrix[1] + this.z_max * matrix[2];
        const y0 = this.x_min * matrix[3] + this.y_min * matrix[4] + this.z_min * matrix[5];
        const y1 = this.x_max * matrix[3] + this.y_max * matrix[4] + this.z_max * matrix[5];
        const z0 = this.x_min * matrix[6] + this.y_min * matrix[7] + this.z_min * matrix[8];
        const z1 = this.x_max * matrix[6] + this.y_max * matrix[7] + this.z_max * matrix[8];

        this.x_min = Math.min(x0, x1);
        this.x_max = Math.max(x0, x1);
        this.y_min = Math.min(y0, y1);
        this.y_max = Math.max(y0, y1);
        this.z_min = Math.min(z0, z1);
        this.z_max = Math.max(z0, z1);

        if (pivot) {
            this.x_min += pivot.x;
            this.y_min += pivot.y;
            this.z_min += pivot.z;
            this.x_max += pivot.x;
            this.y_max += pivot.y;
            this.z_max += pivot.z;
        }

        return this;
    }

    contains(x, y, z) {
        return x >= this.x_min && x < this.x_max
            && y >= this.y_min && y < this.y_max
            && z >= this.z_min && z < this.z_max;
    }

    intersect(box) {
        return (box.x_min < this.x_max && this.x_min < box.x_max
            && box.y_min < this.y_max && this.y_min < box.y_max
            && box.z_min < this.z_max && this.z_min < box.z_max);
    }

    /**
     * rotated around 0
     * @param sym
     */
    rotate(sym, pivot) {
        if (sym === 0) {
            return this;
        }

        return this.applyMatrix(CubeSym.matrices[sym], pivot);
    }

    toArray(target = []) {
        target[0] = this.x_min;
        target[1] = this.y_min;
        target[2] = this.z_min;

        target[3] = this.x_max;
        target[4] = this.y_max;
        target[5] = this.z_max;

        return target;
    }

    translate(x, y, z) {
        this.x_min += x;
        this.x_max += x;
        this.y_min += y;
        this.y_max += y;
        this.z_min += z;
        this.z_max += z;
        return this;
    }

    addPoint(x, y, z) {
        if(x < this.x_min) this.x_min = x;
        if(x > this.x_max) this.x_max = x;
        if(y < this.y_min) this.y_min = y;
        if(y > this.y_max) this.y_max = y;
        if(z < this.z_min) this.z_min = z;
        if(z > this.z_max) this.z_max = z;
        return this;
    }

    // Expand same for all sides
    expand(x, y, z) {
        this.x_min -= x;
        this.x_max += x;
        this.y_min -= y;
        this.y_max += y;
        this.z_min -= z;
        this.z_max += z;
        return this;
    }

    div(value) {
        this.x_min /= value;
        this.x_max /= value;
        this.y_min /= value;
        this.y_max /= value;
        this.z_min /= value;
        this.z_max /= value;
        return this;
    }

}

class AABBPool {
    constructor() {
        this._list = [];
    }

    release(elem) {
        this._list.push(elem);
    }

    alloc() {
        return this._list.pop() || new AABB();
    }

    static instance = new AABBPool();
}

class AABBSideParams {

    constructor(uv, flag, anim, lm = null, axes = null, autoUV) {
        this.uv     = uv;
        this.flag   = flag;
        this.anim   = anim;
        this.lm     = lm;
        this.axes   = axes;
        this.autoUV = autoUV;
    }

}

function pushTransformed$2(
    vertices, mat, pivot,
    cx, cz, cy,
    x0, z0, y0,
    ux, uz, uy,
    vx, vz, vy,
    c0, c1, c2, c3,
    r, g, b,
    flags
) {
    pivot = pivot || defaultPivot$2;
    cx += pivot[0];
    cy += pivot[1];
    cz += pivot[2];
    x0 -= pivot[0];
    y0 -= pivot[1];
    z0 -= pivot[2];

    mat = mat || defaultMatrix$2;

    let tx = 0;
    let ty = 0;
    let tz = 0;

    // unroll mat4 matrix to mat3 + tx, ty, tz
    if (mat.length === 16) {
        mat3$3.fromMat4(tempMatrix$1, mat);

        tx = mat[12];
        ty = mat[14]; // flip
        tz = mat[13]; // flip

        mat = tempMatrix$1;
    }

    vertices.push(
        cx + x0 * mat[0] + y0 * mat[1] + z0 * mat[2] + tx,
        cz + x0 * mat[6] + y0 * mat[7] + z0 * mat[8] + ty,
        cy + x0 * mat[3] + y0 * mat[4] + z0 * mat[5] + tz,

        ux * mat[0] + uy * mat[1] + uz * mat[2],
        ux * mat[6] + uy * mat[7] + uz * mat[8],
        ux * mat[3] + uy * mat[4] + uz * mat[5],

        vx * mat[0] + vy * mat[1] + vz * mat[2],
        vx * mat[6] + vy * mat[7] + vz * mat[8],
        vx * mat[3] + vy * mat[4] + vz * mat[5],

        c0, c1, c2, c3, r, g, b, flags
    );
}

/**
 * Side params for cube
 * @typedef {{up?: AABBSideParams, down?: AABBSideParams, south?: AABBSideParams, north: AABBSideParams, east?: AABBSideParams, west?: AABBSideParams}} ISideSet
 */

/**
 *
 * @param {number[]} vertices
 * @param {AABB} aabb
 * @param {Vector | number[]} pivot
 * @param {number[]} matrix
 * @param {ISideSet} sides
 * @param {boolean} [autoUV]
 * @param {Vector | number[]} [center] - center wicha AABB is placed, same as [x, y, z] in push transformed
 */
function pushAABB(vertices, aabb, pivot = null, matrix = null, sides, center) {

    matrix = matrix || defaultMatrix$2;
    center = center || defalutCenter;
    pivot  = pivot  || defaultPivot$2; 

    const lm_default      = MULTIPLY.COLOR.WHITE;
    const globalFlags     = 0;
    const x               = center.x;
    const y               = center.y;
    const z               = center.z;

    const size = [
        aabb.width, 
        aabb.depth, // fucking flipped ZY
        aabb.height
    ];

    // distance from center to minimal position
    const dist = [
        aabb.x_min - x,
        aabb.z_min - z, // fucking flipped ZY
        aabb.y_min - y
    ];

    for(const key in sides) {

        if (!(key in PLANES)) {
            continue;
        }

        const {
            /*axes,*/ offset, flip
        } = PLANES[key];

        const {
            uv, flag = 0, anim = 1, autoUV = true
        } = sides[key];

        const lm = sides[key].lm || lm_default;
        const axes = sides[key].axes || PLANES[key].axes;

        let uvSize0;
        let uvSize1;

        if(autoUV) {
            uvSize0 = vec3.dot(axes[0], size) * (uv[2]) * flip[0];
            uvSize1 = -vec3.dot(axes[1], size) * (uv[3]) * flip[1];
        } else {
            uvSize0 = uv[2];
            uvSize1 = -uv[3];
        }

        pushTransformed$2(
            vertices, matrix, pivot,
            // center
            x, z, y,
            // offset
            size[0] * offset[0] + dist[0],
            size[1] * offset[1] + dist[1],
            size[2] * offset[2] + dist[2],
            // axisx
            size[0] * axes[0][0],
            size[1] * axes[0][1],
            size[2] * axes[0][2],
            // axisY
            size[0] * axes[1][0],
            size[1] * axes[1][1],
            size[2] * axes[1][2],
            // UV center
            uv[0], uv[1],
            // UV size
            uvSize0, uvSize1,
            // tint location
            lm.r, lm.g,
            // animation
            anim,
            // flags
            globalFlags | flag
        );
    }

}

const width = 1;
const height = .5;
const depth = 1;

// Ступеньки
class style$p {

    //
    static getRegInfo() {
        return {
            styles: ['stairs'],
            func: this.func
        };
    }

    // Return calculated info
    static calculate(block, pos, neighbours = null, chunkManager = null) {

        const {x, y, z}             = pos;
        const aabbs                 = [];
        const cardinal_direction    = block.getCardinalDirection();
        const on_ceil               = BLOCK$1.isOnCeil(block);

        //
        let sw = cardinal_direction == DIRECTION.NORTH || cardinal_direction == DIRECTION.EAST;
        let nw = cardinal_direction == DIRECTION.SOUTH || cardinal_direction == DIRECTION.EAST;
        let en = cardinal_direction == DIRECTION.SOUTH || cardinal_direction == DIRECTION.WEST;
        let se = cardinal_direction == DIRECTION.NORTH || cardinal_direction == DIRECTION.WEST;

        //
        const sides             = {};
        sides.BASE              = null;
        sides[DIRECTION.SOUTH]  = sw;
        sides[DIRECTION.WEST]   = nw;
        sides[DIRECTION.NORTH]  = en;
        sides[DIRECTION.EAST]   = se;

        // Bottom
        let aabb = new AABB();
        aabb.set(x + .5 - width/2, y, z + .5 - depth/2, x + .5 + width/2, y + height, z + .5 + depth/2);
        if(on_ceil) {
            aabb.translate(0, height, 0);
            sides.DOWN = aabb;
        }
        sides.BASE = aabb;

        // Prepare for tops
        // Даже не пытайся это понять и переделать
        const n = BLOCK$1.autoNeighbs(chunkManager, pos, cardinal_direction, neighbours);
        let changed = false;
        if(style$p.checkIfSame(n.SOUTH, on_ceil)) {
            // удаление лишних
            let cd = CubeSym.sub(n.SOUTH.getCardinalDirection(), cardinal_direction);
            if(!(style$p.checkIfSame(n.WEST, on_ceil) && n.WEST.getCardinalDirection() == cardinal_direction) && cd == ROTATE.W) {
                sides[(cardinal_direction + 2) % 4] = false;
                changed = true;
            } else if(!(style$p.checkIfSame(n.EAST, on_ceil) && n.EAST.getCardinalDirection() == cardinal_direction) && cd == ROTATE.E) {
                sides[(cardinal_direction + 3) % 4] = false;
                changed = true;
            }
        }
        if(!changed && style$p.checkIfSame(n.NORTH, on_ceil)) {
            // добавление нужных
            let cd2 = CubeSym.sub(n.NORTH.getCardinalDirection(), cardinal_direction);
            if(cd2 == ROTATE.E) {
                if(!(style$p.checkIfSame(n.WEST, on_ceil) && n.WEST.getCardinalDirection() == cardinal_direction)) {
                    sides[(cardinal_direction + 1) % 4] = true;
                }
            } else if(cd2 == ROTATE.W) {
                if(!(style$p.checkIfSame(n.EAST, on_ceil) && n.EAST.getCardinalDirection() == cardinal_direction)) {
                    sides[(cardinal_direction + 0) % 4] = true;
                }
            }
        }

        // Tops
        const aabb_top = new AABB();
        aabb_top.set(
            x,
            y + height,
            z,
            x + width/2,
            y + height * 2,
            z + depth/2
        );
        if(on_ceil) {
            aabb_top.translate(0, -.5, 0);
        }

        sides[DIRECTION.SOUTH] = sides[DIRECTION.SOUTH] ? aabb_top : null;
        sides[DIRECTION.EAST] = sides[DIRECTION.EAST] ? aabb_top.clone().translate(.5, 0, 0) : null;
        sides[DIRECTION.NORTH] = sides[DIRECTION.NORTH] ? aabb_top.clone().translate(.5, 0, .5) : null;
        sides[DIRECTION.WEST] = sides[DIRECTION.WEST] ? aabb_top.clone().translate(0, 0, .5) : null;

        //
        for(let i in sides) {
            if(sides[i]) {
                aabbs.push(sides[i]);
            }
        }

        //
        const resp = {
            on_ceil: on_ceil,
            aabbs: aabbs,
            sides: sides,
            shapes: null,
            getShapes(translate, expand_value) {
                if(this.shapes) {
                    return this.shapes;
                }
                this.shapes = [];
                const temp = new AABB();
                for(let aabb of this.aabbs) {
                    temp.copyFrom(aabb)
                        .translate(translate.x, translate.y, translate.z)
                        .expand(expand_value, expand_value, expand_value);
                    this.shapes.push(temp.toArray());
                }
                return this.shapes;
            }
        };

        return resp;

    }

    // Return TRUE if block sames
    static checkIfSame = (checked_block, on_ceil) => {
        const checked_block_on_ceil = BLOCK$1.isOnCeil(checked_block);
        if(checked_block_on_ceil != on_ceil) {
            return false;
        }
        return checked_block.id > 0 && checked_block.material.tags && checked_block.material.tags.indexOf('stairs') >= 0;
    }

    // Main func
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        const material              = block.material;
        const texture               = block.material.texture;
        const pos                   = new Vector$1(x, y, z);

        // полная текстура
        const c_up = BLOCK$1.calcTexture(texture, DIRECTION.UP);
        const c_south = BLOCK$1.calcMaterialTexture(material, DIRECTION.SOUTH, width, height);
        const c_north = [...c_south];

        const info = style$p.calculate(block, pos, neighbours);

        //
        if(info.on_ceil) {
            c_south[1] -= c_south[3];
            c_north[1] -= c_north[3];
        }
        c_north[2] *= -1;
        c_north[3] *= -1;

        pushAABB(vertices, info.sides.BASE, pivot, matrix,
            {
                up:     new AABBSideParams(c_up, 0, 1, null, null, false),
                down:   new AABBSideParams(c_up, 0, 1, null, null, false),
                south:  new AABBSideParams(c_south, 0, 1, null, null, false),
                north:  new AABBSideParams(c_north, 0, 1, null, null, false),
                west:   new AABBSideParams(c_north, 0, 1, null, null, false),
                east:   new AABBSideParams(c_south, 0, 1, null, null, false),
            },
            pos
        );

        // Tops
        c_up[2]     /= 2;
        c_up[3]     /= 2;
        c_south[2]  /= 2;
        c_north[2]  /= 2;
        c_south[0]  -= .25 / TX_CNT$4;
        c_north[0]  -= .25 / TX_CNT$4;
        if(info.on_ceil) {
            c_south[1] += .5 / TX_CNT$4;
            c_north[1] += .5 / TX_CNT$4;
        } else {
            c_south[1] -= .5 / TX_CNT$4;
            c_north[1] -= .5 / TX_CNT$4;
        }

        const c_1 = [...c_south];
        const c_2 = [...c_north];
        const c_3 = [...c_north];
        const c_4 = [...c_south];

        // sw
        if(info.sides[DIRECTION.SOUTH]) {
            pushAABB(vertices, info.sides[DIRECTION.SOUTH], pivot, matrix,
                {
                    up:     new AABBSideParams([c_up[0] - .25/TX_CNT$4, c_up[1] + .25/TX_CNT$4, c_up[2], c_up[3]], 0, 1, null, null, false),
                    down:   new AABBSideParams([c_up[0] - .25/TX_CNT$4, c_up[1] - .25/TX_CNT$4, c_up[2], c_up[3]], 0, 1, null, null, false),
                    south:  new AABBSideParams(c_1, 0, 1, null, null, false),
                    west:   new AABBSideParams([c_2[0] + .5/TX_CNT$4, c_2[1], c_2[2], c_2[3]], 0, 1, null, null, false),
                    north:  new AABBSideParams([c_3[0] + .5/TX_CNT$4, c_3[1], c_3[2], c_3[3]], 0, 1, null, null, false),
                    east:  new AABBSideParams(c_4, 0, 1, null, null, false),
                },
                pos
            );
        }


        // se
        if(info.sides[DIRECTION.EAST]) {
            pushAABB(vertices, info.sides[DIRECTION.EAST], pivot, matrix,
                {
                    up:     new AABBSideParams([c_up[0] + .25/TX_CNT$4, c_up[1] + .25/TX_CNT$4, c_up[2], c_up[3]], 0, 1, null, null, false),
                    down:   new AABBSideParams([c_up[0] + .25/TX_CNT$4, c_up[1] - .25/TX_CNT$4, c_up[2], c_up[3]], 0, 1, null, null, false),
                    south:  new AABBSideParams([c_1[0] + .5/TX_CNT$4, c_1[1], c_1[2], c_1[3]], 0, 1, null, null, false),
                    west:   new AABBSideParams([c_2[0] + .5/TX_CNT$4, c_2[1], c_2[2], c_2[3]], 0, 1, null, null, false),
                    north:  new AABBSideParams(c_3, 0, 1, null, null, false),
                    east:  new AABBSideParams(c_4, 0, 1, null, null, false),
                },
                pos
            );
        }

        // en
        if(info.sides[DIRECTION.NORTH]) {
            pushAABB(vertices, info.sides[DIRECTION.NORTH], pivot, matrix,
                {
                    up:     new AABBSideParams([c_up[0] + .25/TX_CNT$4, c_up[1] - .25/TX_CNT$4, c_up[2], c_up[3]], 0, 1, null, null, false),
                    down:   new AABBSideParams([c_up[0] + .25/TX_CNT$4, c_up[1] + .25/TX_CNT$4, c_up[2], c_up[3]], 0, 1, null, null, false),
                    south:  new AABBSideParams([c_1[0] + .5/TX_CNT$4, c_1[1], c_1[2], c_1[3]], 0, 1, null, null, false),
                    west:   new AABBSideParams(c_2, 0, 1, null, null, false),
                    north:  new AABBSideParams(c_3, 0, 1, null, null, false),
                    east:  new AABBSideParams([c_4[0] + .5/TX_CNT$4, c_4[1], c_4[2], c_4[3]], 0, 1, null, null, false),
                },
                pos
            );
        }

        // nw
        if(info.sides[DIRECTION.WEST]) {
            pushAABB(vertices, info.sides[DIRECTION.WEST], pivot, matrix,
                {
                    up:     new AABBSideParams([c_up[0] - .25/TX_CNT$4, c_up[1] - .25/TX_CNT$4, c_up[2], c_up[3]], 0, 1, null, null, false),
                    down:   new AABBSideParams([c_up[0] - .25/TX_CNT$4, c_up[1] + .25/TX_CNT$4, c_up[2], c_up[3]], 0, 1, null, null, false),
                    south:  new AABBSideParams(c_1, 0, 1, null, null, false),
                    west:   new AABBSideParams(c_2, 0, 1, null, null, false),
                    north:  new AABBSideParams([c_3[0] + .5/TX_CNT$4, c_3[1], c_3[2], c_3[3]], 0, 1, null, null, false),
                    east:  new AABBSideParams([c_4[0] + .5/TX_CNT$4, c_4[1], c_4[2], c_4[3]], 0, 1, null, null, false),
                },
                pos
            );
        }

    }

}

var stairs = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': style$p
});

const TRANS_TEX                      = [4, 12];
const WATER_BLOCKS_ID                = [200, 202];
const INVENTORY_STACK_DEFAULT_SIZE   = 64;
const POWER_NO                       = 0;

// Свойства, которые могут сохраняться в БД
const ITEM_DB_PROPS                  = ['power', 'count', 'entity_id', 'extra_data', 'rotate'];
const ITEM_INVENTORY_PROPS           = ['power', 'count', 'entity_id', 'extra_data'];
const ITEM_INVENTORY_KEY_PROPS       = ['power'];

let aabb$3 = new AABB();
let shapePivot = new Vector$1(.5, .5, .5);

let NEIGHB_BY_SYM = {};
NEIGHB_BY_SYM[DIRECTION.FORWARD] = 'NORTH';
NEIGHB_BY_SYM[DIRECTION.BACK] = 'SOUTH';
NEIGHB_BY_SYM[DIRECTION.LEFT] = 'WEST';
NEIGHB_BY_SYM[DIRECTION.RIGHT] = 'EAST';
NEIGHB_BY_SYM[DIRECTION.DOWN] = 'DOWN';
NEIGHB_BY_SYM[DIRECTION.UP] = 'UP';

// BLOCK PROPERTIES:
// fluid (bool)                 - Is fluid
// gravity (bool)               - May fall
// id (int)                     - Unique ID
// instrument_id (string)       - Unique code of instrument type
// inventory_icon_id (int)      - Position in inventory atlas
// max_in_stack (int)           - Max count in inventory or other stack
// name (string)                - Unique name
// passable (float)             - Passable value 0...1
// selflit (bool)               - ?
// sound (string)               - Resource ID
// spawnable (bool)             - Cannot be /give for player
// style (string)               - used for drawing style (cube, fence, ladder, plant, pane, sign, slab, stairs)
// tags (string[])              - Array of string tags
// texture (array | function)   - ?
// transparent (bool)           - Not cube

class Block {

    constructor() {}

}

class Block_Material {

    static materials = {
        data: null,
        checkBlock: async function(resource_pack, block) {
            if(block.material && block.material instanceof Block_Material) {
                return;
            }
            if(!this.data) {
                this.data = await Resources.loadMaterials();
            }
            if(!block.material || !('id' in block.material)) {
                throw 'error_block_has_no_material|' + resource_pack.id + '.' + block.name;
            }
            //
            if(block.item?.instrument_id && !this.data.instruments[block.item.instrument_id]) {
                throw 'error_unknown_instrument|' + block.item.instrument_id;
            }
            //
            const block_material_id = block.material.id;
            if(!this.data.list[block_material_id]) {
                throw 'error_invalid_instrument|' + block_material_id;
            }
            block.material = new Block_Material(this.data.list[block_material_id]);
            block.material.id = block_material_id;
            if(typeof block.mining_time !== 'undefined') {
                block.material.mining.time = block.mining_time;
            }
        }
    };

    constructor(data) {
        Object.assign(this, JSON.parse(JSON.stringify(data)));
    }

    /**
     * Возвращает время, необходимое для того, чтобы разбить блок
     * @param { Object } instrument
     * @param { Bool } force Фиксированное и ускоренное разбитие (например в режиме креатива)
     * @return float
     */
    getMiningTime(instrument, force) {
        let mining_time = this.mining.time;
        if(force) {
            mining_time = 0;
        } else if(instrument && instrument.material) {
            const instrument_id = instrument.material.item?.instrument_id;
            if(instrument_id) {
                if(this.mining.instruments.indexOf(instrument_id) >= 0) {
                    const instrument_boost = instrument.material.material.mining.instrument_boost;
                    if(typeof instrument_boost !== 'undefined' && !isNaN(instrument_boost)) {
                        mining_time = Math.round((mining_time / instrument_boost) * 100) / 100;
                    }
                }
            }
        }
        return mining_time;
    }

}

class BLOCK$1 {

    static list                     = new Map();
    static styles                   = new Map();
    static spawn_eggs               = [];
    static ao_invisible_blocks      = [];
    static resource_pack_manager    = null;
    static max_id                   = 0;
    static MASK_BIOME_BLOCKS        = [];
    static MASK_COLOR_BLOCKS        = [];

    static getBlockTitle(block) {
        if(!block || !('id' in block)) {
            return '';
        }
        let mat = null;
        if('name' in block && 'title' in block) {
            mat = block;
        } else {
            mat = BLOCK$1.fromId(block.id);
        }
        let resp = mat.name;
        if(mat.title) {
            resp += ` (${mat.title})`;
        }
        resp = resp.replaceAll('_', ' ');
        return resp;
    }

    static getLightPower(material) {
        if (!material) {
            return 0;
        }
        let val = 0;
        if(material.light_power) {
            val = Math.floor(material.light_power.a / 16.0);
        } else if (!material.transparent) {
            val = 127;
        }
        return val + (material.visible_for_ao ? 128 : 0);
    }

    // Return flat index of chunk block
    static getIndex(x, y, z) {
        if(x instanceof Vector$1 || typeof x == 'object') {
            y = x.y;
            z = x.z;
            x = x.x;
        }
        let index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * y + (z * CHUNK_SIZE_X) + x;
        return index;
    }

    // Return new simplified item
    static convertItemToDBItem(item) {
        if(!item || !('id' in item)) {
            return null;
        }
        const resp = {
            id: item.id
        };
        for(let k of ITEM_DB_PROPS) {
            let v = item[k];
            if(v !== undefined && v !== null) {
                resp[k] = v;
            }
        }
        return resp;
    }

    // Return new simplified item
    static convertItemToInventoryItem(item, b, no_copy_extra_data = false) {
        if(!item || !('id' in item) || item.id < 0) {
            return null;
        }
        const resp = {
            id: item.id
        };
        if('count' in item) {
            item.count = Math.floor(item.count);
        }
        // fix old invalid instruments power
        if(b && 'power' in b && b.power > 0) {
            if(!item.power) {
                item.power = b.power;
            }
        }
        for(let k of ITEM_INVENTORY_PROPS) {
            if(no_copy_extra_data) {
                if(k == 'extra_data') {
                    continue;
                }
            }
            if(b) {
                if(k in b) {
                    if(k == 'power' && b.power == 0) {
                        continue;
                    }
                }
            }
            let v = item[k];
            if(v !== undefined && v !== null) {
                resp[k] = v;
            }
        }
        return resp;
    }

    //
    static getBlockIndex(x, y, z, v = null) {
        if (x instanceof Vector$1) {
          y = x.y;
          z = x.z;
          x = x.x;
        }

        // функция евклидового модуля
        const f = (n, m) => ((n % m) + m) % m;

        if (v) {
          v.x = f(x, CHUNK_SIZE_X);
          v.y = f(y, CHUNK_SIZE_Y);
          v.z = f(z, CHUNK_SIZE_Z);
        } else {
          v = new Vector$1(f(x, CHUNK_SIZE_X), f(y, CHUNK_SIZE_Y), f(z, CHUNK_SIZE_Z));
        }

        return v;
    }

    // Call before setBlock
    static makeExtraData(block, pos, orientation) {
        block = BLOCK$1.BLOCK_BY_ID.get(block.id);
        let extra_data = null;
        let is_trapdoor = block.tags.indexOf('trapdoor') >= 0;
        let is_stairs = block.tags.indexOf('stairs') >= 0;
        let is_door = block.tags.indexOf('door') >= 0;
        let is_slab = block.is_layering && block.layering.slab;
        if(is_trapdoor || is_stairs || is_door || is_slab) {
            extra_data = {
                point: pos.point ? new Vector$1(pos.point.x, pos.point.y, pos.point.z) : new Vector$1(0, 0, 0)
            };
            // Trapdoor
            if(is_trapdoor) {
                extra_data.opened = false;
            }
            // Door
            if(is_door) {
                extra_data.opened = false;
                extra_data.left = false;
                if(!pos.point) {
                    pos.point = new Vector$1(0, 0, 0);
                }
                switch(orientation.x) {
                    case ROTATE.S: {
                        extra_data.left = pos.point.x < .5;
                        break;
                    }
                    case ROTATE.N: {
                        extra_data.left = pos.point.x >= .5;
                        break;
                    }
                    case ROTATE.W: {
                        extra_data.left = pos.point.z >= .5;
                        break;
                    }
                    case ROTATE.E: {
                        extra_data.left = pos.point.z < .5;
                        break;
                    }
                }
            }
            if(pos.n.y == 1) {
                extra_data.point.y = 0;
            } else if(pos.n.y == -1) {
                extra_data.point.y = 1;
            }
        } else if(block.extra_data) {
            extra_data = JSON.parse(JSON.stringify(block.extra_data));
            extra_data = BLOCK$1.calculateExtraData(extra_data, pos);
        }
        return extra_data;
    }

    // Execute calculated extra_data fields
    static calculateExtraData(extra_data, pos) {
        if('calculated' in extra_data) {
            const calculated = extra_data.calculated;
            delete(extra_data.calculated);
            for(let g of calculated) {
                if(!('name' in g)) {
                    throw 'error_generator_name_not_set';
                }
                switch(g.type) {
                    case 'pos': {
                        extra_data[g.name] = new Vector$1(pos);
                        break;
                    }
                    case 'random_int': {
                        if(!('min_max' in g)) {
                            throw 'error_generator_min_max_not_set';
                        }
                        extra_data[g.name] = Math.floor(Math.random() * (g.min_max[1] - g.min_max[0] + 1) + g.min_max[0]);
                        break;
                    }
                    case 'random_item': {
                        if(!('items' in g)) {
                            throw 'error_generator_items_not_set';
                        }
                        extra_data[g.name] = g.items.length > 0 ? g.items[g.items.length * Math.random() | 0] : null;
                    }
                }
            }
        }
        return extra_data;
    }

    // Returns a block structure for the given id.
    static fromId(id) {
        if(this.BLOCK_BY_ID.has(id)) {
            return this.BLOCK_BY_ID.get(id);
        }
        console.error('Warning: id missing in BLOCK ' + id);
        return this.DUMMY;
    }

    // Returns a block structure for the given id.
    static fromName(name) {
        if(name.indexOf(':') >= 0) {
            name = name.split(':')[1].toUpperCase();
        }
        if(this.hasOwnProperty(name)) {
            return this[name]
        }
        console.error('Warning: name missing in BLOCK ' + name);
        return this.DUMMY;
    }

    // Возвращает True если блок является растением
    static isPlants(id) {
        let b = this.fromId(id);
        return b && !!b.planting;
    }

    // Can replace
    static canReplace(block_id, extra_data, replace_with_block_id) {
        if(block_id == 0) {
            return true;
        }
        if([BLOCK$1.GRASS.id, BLOCK$1.STILL_WATER.id, BLOCK$1.FLOWING_WATER.id, BLOCK$1.STILL_LAVA.id, BLOCK$1.FLOWING_LAVA.id, BLOCK$1.CLOUD.id, BLOCK$1.TALL_GRASS.id, BLOCK$1.TALL_GRASS_TOP.id].indexOf(block_id) >= 0) {
            return true;
        }
        let block = BLOCK$1.BLOCK_BY_ID.get(block_id);
        if(block.is_fluid) {
            return true;
        }
        if(block.is_layering) {
            let height = extra_data ? (extra_data.height ? parseFloat(extra_data.height) : 1) : block.height;
            return !isNaN(height) && height == block.height && block_id != replace_with_block_id;
        }
        return false;
    }

    // Блок может быть уничтожен водой
    static destroyableByWater(block) {
        return block.planting || block.id == this.AIR.id;
    }

    // Стартовый игровой инвентарь
    static getStartInventory() {
        let blocks = [
            Object.assign({count: 5}, this.RED_MUSHROOM),
            Object.assign({count: 64}, this.SAND),
            Object.assign({count: 6}, this.BOOKCASE),
            Object.assign({count: 20}, this.GLOWSTONE),
            Object.assign({count: 4}, this.TEST)
        ];
        for(let key of Object.keys(blocks)) {
            let b = blocks[key];
            delete(b.texture);
            blocks[key] = b;
        }
        return blocks;
    }

    //
    static getBlockStyleGroup(block) {
        let group = 'regular';
        // make vertices array
        if(WATER_BLOCKS_ID.indexOf(block.id) >= 0 || (block.tags && (block.tags.indexOf('alpha') >= 0))) {
            // если это блок воды или облако
            group = 'doubleface_transparent';
        } else if(block.style == 'pane' || block.tags.indexOf('glass') >= 0) {
            group = 'transparent';
        } else if(block.id == 649 ||
            block.tags.indexOf('leaves') >= 0 ||
            block.style == 'planting' || block.style == 'chain' || block.style == 'ladder' ||
            block.style == 'door' || block.style == 'redstone' || block.style == 'pot' || block.style == 'lantern' ||
            block.style == 'azalea' || block.style == 'bamboo' || block.style == 'campfire' || block.style == 'cocoa'
            ) {
            group = 'doubleface';
        }
        return group;
    }

    static reset() {
        BLOCK$1.spawn_eggs             = [];
        BLOCK$1.ao_invisible_blocks    = [];
        BLOCK$1.list                   = new Map();
        BLOCK$1.BLOCK_BY_ID            = new Map();
        BLOCK$1.BLOCK_BY_TAGS          = new Map();
        BLOCK$1.list_arr               = [];
    }

    // parseBlockStyle...
    static parseBlockStyle(block) {
        return block.hasOwnProperty('style') ? block.style : 'default';
    }

    // parseBlockTransparent...
    static parseBlockTransparent(block) {
        let transparent = block.hasOwnProperty('transparent') && !!block.transparent;
        if(block.style && block.style == 'stairs') {
            transparent = true;
        }
        return transparent;
    }

    // add
    static async add(resource_pack, block) {
        // Check duplicate ID
        if(!('name' in block) || !('id' in block)) {
            throw 'error_invalid_block';
        }
        const existing_block = this.BLOCK_BY_ID.has(block.id) ? this.fromId(block.id) : null;
        const replace_block = existing_block && (block.name == existing_block.name);
        const original_props = Object.keys(block);
        if(existing_block) {
            if(replace_block) {
                for(let prop_name in existing_block) {
                    if(original_props.indexOf(prop_name) < 0) {
                        block[prop_name] = existing_block[prop_name];
                    }
                }
            } else {
                console.error('Duplicate block id ', block.id, block);
            }
        }
        // Check block material
        await Block_Material.materials.checkBlock(resource_pack, block);
        if(!block.sound) {
            if(block.id > 0) {
                if(!block.item) {
                    let material_id = null;
                    if(['stone', 'grass', 'wood', 'glass', 'sand'].indexOf(block.material.id) >= 0) {
                        material_id = block.material.id;
                    } else {
                        switch(block.material.id) {
                            case 'ice':
                            case 'netherite':
                            case 'terracota': {
                                material_id = 'stone';
                                break;
                            }
                            case 'plant':
                            case 'dirt':
                            case 'leaves': {
                                material_id = 'grass';
                                break;
                            }
                            default: {
                                // console.log(block.name, block.material.id);
                            }
                        }
                    }
                    if(material_id) {
                        block.sound = `madcraft:block.${material_id}`;
                    }
                }
            }
        }
        //
        block.has_window        = !!block.window;
        block.style             = this.parseBlockStyle(block);
        block.tags              = block?.tags || [];
        block.power             = (('power' in block) && !isNaN(block.power) && block.power > 0) ? block.power : POWER_NO;
        block.group             = this.getBlockStyleGroup(block);
        block.selflit           = block.hasOwnProperty('selflit') && !!block.selflit;
        block.deprecated        = block.hasOwnProperty('deprecated') && !!block.deprecated;
        block.transparent       = this.parseBlockTransparent(block);
        block.is_water          = block.is_fluid && WATER_BLOCKS_ID.indexOf(block.id) >= 0;
        block.is_jukebox        = block.tags.indexOf('jukebox') >= 0;
        block.is_mushroom_block = block.tags.indexOf('mushroom_block') >= 0;
        block.is_button         = block.tags.indexOf('button') >= 0;
        block.is_sapling        = block.tags.indexOf('sapling') >= 0;
        block.is_battery        = ['car_battery'].indexOf(block?.item?.name) >= 0;
        block.is_layering       = !!block.layering;
        block.planting          = ('planting' in block) ? block.planting : (block.material.id == 'plant');
        block.resource_pack     = resource_pack;
        block.material_key      = BLOCK$1.makeBlockMaterialKey(resource_pack, block);
        block.can_rotate        = 'can_rotate' in block ? block.can_rotate : block.tags.filter(x => ['trapdoor', 'stairs', 'door'].indexOf(x) >= 0).length > 0;
        block.tx_cnt            = BLOCK$1.calcTxCnt(block);
        block.uvlock            = !('uvlock' in block) ? true : false;
        block.invisible_for_cam = block.material.id == 'plant' && block.style == 'planting';
        // rotate_by_pos_n_plus
        if(block.tags.indexOf('rotate_by_pos_n_plus') >= 0) {
            block.tags.push('rotate_by_pos_n');
        }
        //
        if(block.planting && !('inventory_style' in block)) {
            block.inventory_style = 'extruder';
        }
        // Set default properties
        let default_properties = {
            light:              null,
            texture_animations: null,
            passable:           0,
            spawnable:          true,
            max_in_stack:       INVENTORY_STACK_DEFAULT_SIZE
        };
        for(let [k, v] of Object.entries(default_properties)) {
            if(!block.hasOwnProperty(k)) {
                block[k] = v;
            }
        }
        // Add to ao_invisible_blocks list
        if(block.planting || block.style == 'fence' || block.style == 'wall' || block.style == 'pane' || block.style == 'ladder' || block.light_power || block.tags.indexOf('no_drop_ao') >= 0) {
            if(this.ao_invisible_blocks.indexOf(block.id) < 0) {
                this.ao_invisible_blocks.push(block.id);
            }
        }
        // Calculate in last time, after all init procedures
        block.visible_for_ao = BLOCK$1.visibleForAO(block);
        block.light_power_number = BLOCK$1.getLightPower(block);
        // Append to collections
        if(replace_block) {
            original_props.push('resource_pack');
            original_props.push('material_key');
            original_props.push('tx_cnt');
            for(let prop_name of original_props) {
                existing_block[prop_name] = block[prop_name];
            }
            block = existing_block;
        } else {
            this[block.name] = block;
            BLOCK$1.BLOCK_BY_ID.set(block.id, block);
            this.list.set(block.id, block);
        }
        // After add works
        // Add spawn egg
        if(block.spawn_egg && BLOCK$1.spawn_eggs.indexOf(block.id) < 0) {
            BLOCK$1.spawn_eggs.push(block.id);
        }
        if(block.tags.indexOf('mask_biome') >= 0 && BLOCK$1.MASK_BIOME_BLOCKS.indexOf(block.id) < 0) {
            BLOCK$1.MASK_BIOME_BLOCKS.push(block.id);
        }
        if(block.tags.indexOf('mask_color') >= 0 && BLOCK$1.MASK_COLOR_BLOCKS.indexOf(block.id) < 0) {
            BLOCK$1.MASK_COLOR_BLOCKS.push(block.id);
        }
        // Parse tags
        for(let tag of block.tags) {
            if(!this.BLOCK_BY_TAGS.has(tag)) {
                this.BLOCK_BY_TAGS.set(tag, new Map());
            }
            this.BLOCK_BY_TAGS.get(tag).set(block.id, block);
        }
        // Max block ID
        if(block.id > this.max_id) {
            this.max_id = block.id;
        }
    }

    // Make material key
    static makeBlockMaterialKey(resource_pack, material) {
        let mat_group = material.group;
        let texture_id = 'default';
        if(typeof material.texture == 'object' && 'id' in material.texture) {
            texture_id = material.texture.id;
        }
        return `${resource_pack.id}/${mat_group}/${texture_id}`;
    }

    // Return tx_cnt from resource pack texture
    static calcTxCnt(material) {
        let tx_cnt = TX_CNT$4;
        if (typeof material.texture === 'object' && 'id' in material.texture) {
            let tex = material.resource_pack.conf.textures[material.texture.id];
            if(tex && 'tx_cnt' in tex) {
                tx_cnt = tex.tx_cnt;
            }
        } else {
            let tex = material.resource_pack.conf.textures['default'];
            if(tex && 'tx_cnt' in tex) {
                tx_cnt = tex.tx_cnt;
            }
        }
        return tx_cnt;
    }

    // getAll
    static getAll() {
        return this.list_arr;
    }

    static isEgg(block_id) {
        return BLOCK$1.spawn_eggs.indexOf(block_id) >= 0;
    }

    // Возвращает координаты текстуры с учетом информации из ресурс-пака
    static calcMaterialTexture(material, dir, width, height, block, force_tex) {
        const tx_cnt = material.tx_cnt;
        let texture = force_tex || material.texture;
        // Stages
        if(block && material.stage_textures && block && block.extra_data) {
            if('stage' in block.extra_data) {
                let stage = block.extra_data.stage;
                stage = Math.max(stage, 0);
                stage = Math.min(stage, material.stage_textures.length - 1);
                texture = material.stage_textures[stage];
            }
        }
        // Mushroom block
        if(material.is_mushroom_block) {
            let t = block?.extra_data?.t;
            if(block && t) {
                texture = material.texture.down;
                if(dir == DIRECTION.UP && (t >> DIRECTION_BIT$1.UP) % 2 != 0) texture = material.texture.side;
                if(dir == DIRECTION.DOWN && (t >> DIRECTION_BIT$1.DOWN) % 2 != 0) texture = material.texture.side;
                if(dir == DIRECTION.WEST && (t >> DIRECTION_BIT$1.WEST) % 2 != 0) texture = material.texture.side;
                if(dir == DIRECTION.EAST && (t >> DIRECTION_BIT$1.EAST) % 2 != 0) texture = material.texture.side;
                if(dir == DIRECTION.NORTH && (t >> DIRECTION_BIT$1.NORTH) % 2 != 0) texture = material.texture.side;
                if(dir == DIRECTION.SOUTH && (t >> DIRECTION_BIT$1.SOUTH) % 2 != 0) texture = material.texture.side;
            } else {
                texture = material.texture.down;
            }
        }
        let c = this.calcTexture(texture, dir, tx_cnt);
        if(width && width < 1) {
            c[2] *= width;
        }
        if(height && height < 1) {
            c[1] += 0.5 / tx_cnt - height / tx_cnt / 2;
            c[3] *= height;
        }
        /*if(dir == DIRECTION.UP) {
            c[2] *= -1;
            c[3] *= -1;
        }*/
        //if(dir == DIRECTION.NORTH || dir == DIRECTION.WEST) {
            //c[2] *= -1;
            //c[3] *= -1;
        //}
        return c;
    }

    // getAnimations...
    static getAnimations(material, side) {
        if(!material.texture_animations) {
            return 0;
        }
        if(side in material.texture_animations) {
            return material.texture_animations[side];
        } else if('side' in material.texture_animations) {
            return material.texture_animations['side'];
        }
        return 0;
    }

    // Возвращает координаты текстуры
    static calcTexture(c, dir, tx_cnt) {
        if(typeof tx_cnt == 'undefined') {
            tx_cnt = TX_CNT$4;
        }
        if (c instanceof Array) {
            // do nothing
        } else if(c instanceof Function) {
            c = c(dir);
        } else if (typeof c === 'object' && c !== null) {
            let prop = null;
            switch(dir) {
                case DIRECTION.UP: {prop = 'up'; break;}
                case DIRECTION.DOWN: {prop = 'down'; break;}
                case DIRECTION.LEFT: {prop = 'west'; break;}
                case DIRECTION.RIGHT: {prop = 'east'; break;}
                case DIRECTION.FORWARD: {prop = 'north'; break;}
                case DIRECTION.BACK: {prop = 'south'; break;}
            }
            if(c.hasOwnProperty(prop)) {
                c = c[prop];
            } else if(c.hasOwnProperty('side')) {
                c = c.side;
            } else {
                throw 'Invalid texture prop `' + prop + '`';
            }
        }
        if(!c) {
            debugger;
        }
        const flags = c[2] | 0;
        return [
            (c[0] + 0.5) / tx_cnt,
            (c[1] + 0.5) / tx_cnt,
            ((flags & 1) != 0) ? - 1 / tx_cnt : 1 / tx_cnt,
            ((flags & 2) != 0)  ? - 1 / tx_cnt : 1 / tx_cnt
        ];
    }

    // Функция определяет, отбрасывает ли указанный блок тень
    static visibleForAO(block) {
        if(!block) return false;
        if(typeof block == 'undefined') return false;
        let block_id = block;
        if(typeof block !== 'number') {
            block_id = block.id;
        }
        if(block_id < 1) return false;
        if(this.ao_invisible_blocks.indexOf(block_id) >= 0) return false;
        return true;
    }

    // Return inventory icon pos
    static getInventoryIconPos(
        inventory_icon_id,
        inventory_image_size = 2048,
        frameSize = 128
    ) {
        const w = frameSize;
        const h = frameSize;
        const icons_per_row = inventory_image_size / w;

        return new Vector4(
            (inventory_icon_id % icons_per_row) * w,
            Math.floor(inventory_icon_id / icons_per_row) * h,
            w,
            h
        );
    }

    //
    static registerStyle(style) {
        let reg_info = style.getRegInfo();
        for(let style of reg_info.styles) {
            BLOCK$1.styles.set(style, reg_info);
        }
    }

    //
    static getCardinalDirection(vec3) {
        if (!vec3) {
            return 0;
        }
        if (vec3.x && !(vec3.y * vec3.z)) {
            if(vec3.x >= 0 && vec3.x < 48 && vec3.x == Math.round(vec3.x)) {
                return vec3.x;
            }
        }
        if(vec3) {
            if(vec3.z >= 45 && vec3.z < 135) {
                return ROTATE.E;
            } else if(vec3.z >= 135 && vec3.z < 225) {
                return ROTATE.S;
            } else if(vec3.z >= 225 && vec3.z < 315) {
                return ROTATE.W;
            } else {
                return ROTATE.N;
            }
        }
        return CubeSym.ID; //was E
    }

    static isOnCeil(block) {
        return block.extra_data && block.extra_data?.point?.y >= .5; // на верхней части блока (перевернутая ступенька, слэб)
    }

    static isOpened(block) {
        return !!(block.extra_data && block.extra_data.opened);
    }

    static canFenceConnect(block) {
        return block.id > 0 && (!block.properties.transparent || block.properties.style == 'fence' || block.properties.style == 'wall' || block.properties.style == 'pane');
    }

    static canWallConnect(block) {
        return block.id > 0 && (!block.properties.transparent || block.properties.style == 'wall' || block.properties.style == 'pane' || block.properties.style == 'fence');
    }

    static canPaneConnect(block) {
        return this.canWallConnect(block);
    };

    static canRedstoneDustConnect(block) {
        return block.id > 0 && (block.properties && 'redstone' in block.properties);
    }

    static autoNeighbs(chunkManager, pos, cardinal_direction, neighbours) {
        const mat = CubeSym.matrices[cardinal_direction];
        if (!neighbours) {
            return {
                NORTH: chunkManager.getBlock(pos.x + mat[2], pos.y + mat[5], pos.z + mat[8]),
                SOUTH: chunkManager.getBlock(pos.x - mat[2], pos.y - mat[5], pos.z - mat[8]),
                EAST: chunkManager.getBlock(pos.x + mat[0], pos.y + mat[3], pos.z + mat[6]),
                WEST: chunkManager.getBlock(pos.x - mat[0], pos.y - mat[3], pos.z - mat[6])
            }
        }
        return {
            WEST: neighbours[NEIGHB_BY_SYM[CubeSym.dirAdd(cardinal_direction, DIRECTION.LEFT)]],
            EAST: neighbours[NEIGHB_BY_SYM[CubeSym.dirAdd(cardinal_direction, DIRECTION.RIGHT)]],
            NORTH: neighbours[NEIGHB_BY_SYM[CubeSym.dirAdd(cardinal_direction, DIRECTION.FORWARD)]],
            SOUTH: neighbours[NEIGHB_BY_SYM[CubeSym.dirAdd(cardinal_direction, DIRECTION.BACK)]],
        }
    }

    // getShapes
    static getShapes(pos, b, world, for_physic, expanded, neighbours) {
        let shapes = []; // x1 y1 z1 x2 y2 z2
        const material = b.properties;
        if(!material) {
            return shapes;
        }
        let f = !!expanded ? .001 : 0;
        if(!material.passable && !material.planting) {
            switch(material.style) {
                case 'fence': {
                    let height = for_physic ? 1.5 : 1;
                    //
                    let n = this.autoNeighbs(world.chunkManager, pos, 0, neighbours);
                    // world.chunkManager.getBlock(pos.x, pos.y, pos.z);
                    // South z--
                    if(this.canFenceConnect(n.SOUTH)) {
                        shapes.push([.5-2/16, 5/16, 0, .5+2/16, height, .5+2/16]);
                    }
                    // North z++
                    if(this.canFenceConnect(n.NORTH)) {
                        shapes.push([.5-2/16, 5/16, .5-2/16, .5+2/16, height, 1]);
                    }
                    // West x--
                    if(this.canFenceConnect(n.WEST)) {
                        shapes.push([0, 5/16, .5-2/16, .5+2/16, height, .5+2/16]);
                    }
                    // East x++
                    if(this.canFenceConnect(n.EAST)) {
                        shapes.push([.5-2/16, 5/16, .5-2/16, 1, height, .5+2/16]);
                    }
                    // Central
                    shapes.push([
                        .5-2/16, 0, .5-2/16,
                        .5+2/16, height, .5+2/16
                    ]);
                    break;
                }
                case 'wall': {
                    const CENTER_WIDTH      = 8 / 16;
                    const CONNECT_WIDTH     = 6 / 16;
                    const CONNECT_HEIGHT    = 14 / 16;
                    const CONNECT_BOTTOM    = 0 / 16;
                    const CONNECT_X         = 6 / 16;
                    const CONNECT_Z         = 8 / 16;
                    const height            = for_physic ? 1.5 : CONNECT_HEIGHT;
                    //
                    let zconnects = 0;
                    let xconnects = 0;
                    //
                    let n = this.autoNeighbs(world.chunkManager, pos, 0, neighbours);
                    // world.chunkManager.getBlock(pos.x, pos.y, pos.z);
                    // South z--
                    if(this.canWallConnect(n.SOUTH)) {
                        shapes.push([.5-CONNECT_X/2, CONNECT_BOTTOM, 0, .5-CONNECT_X/2 + CONNECT_X, height, CONNECT_Z/2]);
                        zconnects++;
                    }
                    // North z++
                    if(this.canWallConnect(n.NORTH)) {
                        if(zconnects) {
                            shapes.pop();
                            shapes.push([.5-CONNECT_X/2, CONNECT_BOTTOM, 0, .5-CONNECT_X/2 + CONNECT_X, height, 1]);
                        } else {
                            shapes.push([.5-CONNECT_X/2, CONNECT_BOTTOM, .5+CONNECT_Z/2, .5-CONNECT_X/2 + CONNECT_X, height, .5+CONNECT_Z]);
                        }
                        zconnects++;
                    }
                    // West x--
                    if(this.canWallConnect(n.WEST)) {
                        shapes.push([0, CONNECT_BOTTOM, .5-CONNECT_X/2, CONNECT_Z/2, height, .5-CONNECT_X/2 + CONNECT_X]);
                        xconnects++;
                    }
                    // East x++
                    if(this.canWallConnect(n.EAST)) {
                        if(xconnects) {
                            shapes.pop();
                            shapes.push([0, CONNECT_BOTTOM, .5-CONNECT_X/2, 1, height, .5-CONNECT_X/2 + CONNECT_X]);
                        } else {
                            shapes.push([1 - CONNECT_Z/2, CONNECT_BOTTOM, .5-CONNECT_X/2, 1, height, .5-CONNECT_X/2 + CONNECT_X]);
                        }
                        xconnects++;
                    }
                    if((zconnects == 2 && xconnects == 0) || (zconnects == 0 && xconnects == 2)) {
                        // do nothing
                    } else {
                        // Central
                        shapes.push([
                            .5-CENTER_WIDTH/2, 0, .5-CENTER_WIDTH/2,
                            .5+CENTER_WIDTH/2, Math.max(height, 1), .5+CENTER_WIDTH/2
                        ]);
                    }
                    break;
                }
                case 'thin': {
                    // F R B L
                    let cardinal_direction = b.getCardinalDirection();
                    shapes.push(aabb$3.set(0, 0, .5-1/16, 1, 1, .5+1/16).rotate(cardinal_direction, shapePivot).toArray());
                    break;
                }
                case 'pane': {
                    let height = 1;
                    let w = 2/16;
                    let w2 = w/2;
                    //
                    let n = this.autoNeighbs(world.chunkManager, pos, 0, neighbours);
                    // world.chunkManager.getBlock(pos.x, pos.y, pos.z);
                    let con_s = this.canPaneConnect(n.SOUTH);
                    let con_n = this.canPaneConnect(n.NORTH);
                    let con_w = this.canPaneConnect(n.WEST);
                    let con_e = this.canPaneConnect(n.EAST);
                    let remove_center = con_s || con_n || con_w || con_e;
                    //
                    if(con_s && con_n) {
                        // remove_center = true;
                        shapes.push([.5-w2, 0, 0, .5+w2, height, .5+.5]);
                    } else {
                        // South z--
                        if(con_s) {
                            shapes.push([.5-w2, 0, 0, .5+w2, height, .5+w2]);
                        }
                        // North z++
                        if(con_n) {
                            shapes.push([.5-w2,0, .5-w2, .5+w2, height, 1]);
                        }
                    }
                    if(con_w && con_e) {
                        // remove_center = true;
                        shapes.push([0, 0, .5-w2, 1, height, .5+w2]);
                    } else {
                        // West x--
                        if(con_w) {
                            shapes.push([0, 0, .5-w2, .5+w2, height, .5+w2]);
                        }
                        // East x++
                        if(con_e) {
                            shapes.push([.5-w2, 0, .5-w2, 1, height, .5+w2]);
                        }
                    }
                    // Central
                    if(!remove_center) {
                        shapes.push([.5-w2, 0, .5-w2, .5+w2, height, .5+w2]);
                    }
                    break;
                }
                case 'stairs': {
                    shapes.push(...style$p.calculate(b, pos, neighbours, world.chunkManager).getShapes(new Vector$1(pos).multiplyScalar(-1), f));
                    break;
                }
                case 'trapdoor': {
                    let cardinal_direction = b.getCardinalDirection();
                    let opened = this.isOpened(b);
                    let on_ceil = this.isOnCeil(b);
                    let sz = 3 / 15.9;
                    if(opened) {
                        shapes.push(aabb$3.set(0, 0, 0, 1, 1, sz).rotate(cardinal_direction, shapePivot).toArray());
                    } else {
                        if(on_ceil) {
                            shapes.push(aabb$3.set(0, 1-sz, 0, 1, 1, 1, sz).rotate(cardinal_direction, shapePivot).toArray());
                        } else {
                            shapes.push(aabb$3.set(0, 0, 0, 1, sz, 1, sz).rotate(cardinal_direction, shapePivot).toArray());
                        }
                    }
                    break;
                }
                case 'door': {
                    let cardinal_direction = CubeSym.dirAdd(b.getCardinalDirection(), CubeSym.ROT_Y2);
                    if(this.isOpened(b)) {
                        cardinal_direction = CubeSym.dirAdd(cardinal_direction, b.extra_data.left ? DIRECTION.RIGHT : DIRECTION.LEFT);
                    }
                    let sz = 3 / 15.9;
                    shapes.push(aabb$3.set(0, 0, 0, 1, 1, sz).rotate(cardinal_direction, shapePivot).toArray());
                    break;
                }
                default: {
                    const styleVariant = BLOCK$1.styles.get(material.style);
                    if (styleVariant && styleVariant.aabb) {
                        shapes.push(
                            ...styleVariant.aabb(b, for_physic).map(aabb => aabb.toArray())
                        );
                    } else {
                        debugger
                        console.error('Deprecated');
                    }
                    break;
                }
            }
        } else {
            if(!for_physic) {
                const styleVariant = BLOCK$1.styles.get(material.style);
                if (styleVariant && styleVariant.aabb) {
                    let aabbs = styleVariant.aabb(b);
                    if(!Array.isArray(aabbs)) {
                        aabbs = [aabbs];
                    }
                    shapes.push(
                        ...aabbs.map(aabb => aabb.toArray())
                    );
                } else {
                    switch(material.style) {
                        /*case 'sign': {
                            let hw = (4/16) / 2;
                            let sign_height = 1;
                            shapes.push([
                                .5-hw, 0, .5-hw,
                                .5+hw, sign_height, .5+hw
                            ]);
                            break;
                        }*/
                        case 'planting': {
                            let hw = (12/16) / 2;
                            let h = 12/16;
                            shapes.push([.5-hw, 0, .5-hw, .5+hw, h, .5+hw]);
                            break;
                        }
                        case 'ladder': {
                            let cardinal_direction = b.getCardinalDirection();
                            let width = 1/16;
                            shapes.push(aabb$3.set(0, 0, 0, 1, 1, width).rotate(cardinal_direction, shapePivot).toArray());
                            break;
                        }
                    }
                }
            }
        }
        return shapes;
    }

    //
    static async sortBlocks() {
        //
        const sortByMaterial = (b, index) => {
            if(b.tags.indexOf('ore') >= 0) {
                index -= .01;
            } else if(b.window) {
                index -= .02;
            } else if(b.material.id == 'stone') {
                index -= .03;
            } else if(b.material.id == 'wood') {
                index -= .04;
            } else if(b.material.id == 'iron') {
                index -= .05;
            } else if(b.material.id == 'glass') {
                index -= .06;
            } else if(b.material.id == 'leaves') {
                index -= .07;
            } else if(b.material.id == 'dirt') {
                index -= .08;
            }
            return index;
        };
        //
        const all_blocks = [];
        for(let b of BLOCK$1.list.values()) {
            b.sort_index = 1000;
            if(b.item && !b.item?.instrument_id) {
                b.sort_index = sortByMaterial(b, 101);
            } else if(b.material.id == 'leather') {
                b.sort_index = 100;
            } else if(b.material.id == 'food') {
                b.sort_index = 99;
            } else if(b.material.id == 'bone') {
                b.sort_index = 98;
            } else if(b.material.id == 'plant') {
                b.sort_index = 97;
            } else if(b.style == 'planting') {
                b.sort_index = 96;
            } else if(b.item?.instrument_id) {
                b.sort_index = 95;
            } else if(b.style == 'stairs') {
                b.sort_index = sortByMaterial(b, 94);
            } else if(b.style == 'fence') {
                b.sort_index = sortByMaterial(b, 93);
            } else if(b.style == 'door') {
                b.sort_index = sortByMaterial(b, 92);
            } else if(b.style == 'trapdoor') {
                b.sort_index = sortByMaterial(b, 91);
            } else if(b.style == 'bed') {
                b.sort_index = 90;
            } else if(b.style == 'sign') {
                b.sort_index = 89;
            } else if(b.style == 'wall') {
                b.sort_index = sortByMaterial(b, 88);
            } else if(b.style == 'carpet') {
                b.sort_index = 87;
            } else if(b.layering) {
                b.sort_index = sortByMaterial(b, 86);
            } else if(b.material.id == 'glass') {
                b.sort_index = 85;
            } else if((b.width || b.height || b.depth) && !b.window && b.material.id != 'dirt') {
                b.sort_index = 84;
            } else if(b.style == 'default' || b.style == 'cube') {
                b.sort_index = sortByMaterial(b, 83);
            } else {
                b.sort_index = sortByMaterial(b, 101);
            }
            all_blocks.push(b);
        }
        //
        all_blocks.sort((a, b) => {
            return a.sort_index - b.sort_index;
        });
        //
        BLOCK$1.list_arr = [];
        for(let b of all_blocks) {
            BLOCK$1.list_arr.push(b);
        }
    }

};

// Init
BLOCK$1.init = async function(settings) {

    if(BLOCK$1.list.size > 0) {
        throw 'error_blocks_already_inited';
    }

    BLOCK$1.reset();

    // Resource packs
    BLOCK$1.resource_pack_manager = new ResourcePackManager(BLOCK$1);

    // block styles and resorce styles is independent (should)
    // block styles is how blocks is generated
    // resource styles is textures for it

    return Promise.all([
        Resources.loadBlockStyles(settings),
        BLOCK$1.resource_pack_manager.init(settings)
    ]).then(async ([block_styles, _]) => {
        //
        await BLOCK$1.sortBlocks();
        // Block styles
        for(let style of block_styles.values()) {
            BLOCK$1.registerStyle(style);
        }
    });
};

var blocks = /*#__PURE__*/Object.freeze({
	__proto__: null,
	TRANS_TEX: TRANS_TEX,
	WATER_BLOCKS_ID: WATER_BLOCKS_ID,
	INVENTORY_STACK_DEFAULT_SIZE: INVENTORY_STACK_DEFAULT_SIZE,
	POWER_NO: POWER_NO,
	ITEM_DB_PROPS: ITEM_DB_PROPS,
	ITEM_INVENTORY_PROPS: ITEM_INVENTORY_PROPS,
	ITEM_INVENTORY_KEY_PROPS: ITEM_INVENTORY_KEY_PROPS,
	NEIGHB_BY_SYM: NEIGHB_BY_SYM,
	BLOCK: BLOCK$1
});

const CC = [
    {x:  0, y:  1, z:  0, name: 'UP'},
    {x:  0, y: -1, z:  0, name: 'DOWN'},
    {x:  0, y:  0, z: -1, name: 'SOUTH'},
    {x:  0, y:  0, z:  1, name: 'NORTH'},
    {x: -1, y:  0, z:  0, name: 'WEST'},
    {x:  1, y:  0, z:  0, name: 'EAST'}
];

// BlockNeighbours
class BlockNeighbours {

    constructor() {
        this.pcnt   = 6;
        this.water_in_water = false;
        this.UP     = null;
        this.DOWN   = null;
        this.SOUTH  = null;
        this.NORTH  = null;
        this.WEST   = null;
        this.EAST   = null;
    }

}

class TBlock {

    constructor(tb, vec, index) {
        this.init(tb, vec, index);
    }

    init(tb = this.tb, vec = this.vec, index = undefined) {
        //TODO try remove third param
        this.tb = tb;
        this.vec = vec;
        this.index = index || (this.vec ? BLOCK$1.getIndex(this.vec) : NaN);
        return this;
    }

    get posworld() {
        return this.vec.add(this.tb.coord);
    }

    //
    get pos() {
        return this.vec;
    }

    //
    get id() {
        return this.tb.id[this.index];
    }
    set id(value) {
        // let cu = this.tb.id[this.index];
        // this.tb.non_zero += (!cu && value) ? 1 : ((cu && !value) ? -1 : 0);
        if (this.tb.dataChunk.portals) {
            this.tb.setBlockId(this.vec.x, this.vec.y, this.vec.z, value);
        } else {
            this.tb.id[this.index] = value;
        }
    }

    //
    get power() {
        let resp = this.tb.power.get(this.vec);
        if(resp === null) resp = POWER_NO;
        return resp;
    }
    set power(value) {
        if(value) return this.tb.power.set(this.vec, value);
        this.tb.power.delete(this.vec);
    }

    //
    get rotate() {
        return this.tb.rotate.get(this.vec);
    }
    set rotate(value) {
        if(value) return this.tb.rotate.set(this.vec, value);
        this.tb.rotate.delete(this.vec);
    }

    // entity_id
    get entity_id() {
        return this.tb.entity_id.get(this.vec);
    }
    set entity_id(value) {
        if(value) return this.tb.entity_id.set(this.vec, value);
        this.tb.entity_id.delete(this.vec);
    }

    // texture
    get texture() {
        return this.tb.texture.get(this.vec);
    }
    set texture(value) {
        if(value) return this.tb.texture.set(this.vec, value);
        this.tb.texture.delete(this.vec);
    }

    // extra_data
    get extra_data() {
        return this.tb.extra_data.get(this.vec);
    }
    set extra_data(value) {
        if(value) return this.tb.extra_data.set(this.vec, value);
        this.tb.extra_data.delete(this.vec);
    }

    // falling
    get falling() {
        return this.tb.falling.get(this.vec);
    }
    set falling(value) {
        if(value) return this.tb.falling.set(this.vec, value);
        this.tb.falling.delete(this.vec);
    }

    // vertices
    get vertices() {
        return this.tb.vertices.get(this.vec);
    }
    set vertices(value) {
        if(value !== null) return this.tb.vertices.set(this.vec, value);
        this.tb.vertices.delete(this.vec);
    }

    // shapes
    get shapes() {
        return this.tb.shapes.get(this.vec);
    }
    set shapes(value) {
        if(value) return this.tb.shapes.set(this.vec, value);
        this.tb.shapes.delete(this.vec);
    }

    // properties
    get properties() {
        return BLOCK$1.BLOCK_BY_ID.get(this.id) || null;
    }

    // material
    get material() {
        return BLOCK$1.BLOCK_BY_ID.get(this.id) || null;
    }

    //
    getCardinalDirection() {
        return BLOCK$1.getCardinalDirection(this.rotate);
    }

    // Дальнейшие свойства нужны только для prismarine-physics (физика перса)
    //
    get type() {
        return this.id;
    }
    getProperties() {
        return this.properties;
    }
    // position
    get position() {
        // return new Vector(this.vec.x + this.tb.coord.x, this.vec.y + this.tb.coord.y, this.vec.z + this.tb.coord.z);
        return this.tb.position.get(this.vec);
    }
    set position(value) {
        if(value) return this.tb.position.set(this.vec, value);
        this.tb.position.delete(this.vec);
    }
    get metadata() {
        return this.tb.metadata.get(this.vec);
    }

    getSound() {
        let sound = null;
        if(this.id) {
            let mat = this.material;
            sound = mat.hasOwnProperty('sound') ? mat.sound : null;
        }
        return sound;
    }

    isPlant() {
        return this.material.planting;
    }

    canReplace() {
        return BLOCK$1.canReplace(this.id, this.extra_data);
    }

    hasTag(tag) {
        let mat = this.material;
        return mat.tags && mat.tags.indexOf(tag) >= 0;
    }

    convertToDBItem() {
        return BLOCK$1.convertItemToDBItem(this);
    }

    /**
     * Возвращает всех 6-х соседей блока
     * @param {Vector} pos
     * @param {Array} cache
     * @returns
     */
    getNeighbours(world, cache) {
        if (this.tb.getNeighbours) {
            return this.tb.getNeighbours(this, world, cache);
        }

        const neighbours = new BlockNeighbours();
        const nc = this.tb.getNeightboursChunks(world);
        const pos = this.vec;
        let chunk;
        let is_water_count = 0;
        // обходим соседние блоки
        for (let i = 0; i < CC.length; i++) {
            const p = CC[i];
            const cb = cache[i]; // (cache && cache[i]) || new TBlock(null, new Vector());
            const v = cb.vec;
            const ax = pos.x + p.x;
            const ay = pos.y + p.y;
            const az = pos.z + p.z;
            if(ax >= 0 && ay >= 0 && az >= 0 && ax < CHUNK_SIZE_X && ay < CHUNK_SIZE_Y && az < CHUNK_SIZE_Z) {
                v.x = ax;
                v.y = ay;
                v.z = az;
                chunk = nc.that.chunk;
            } else {
                v.x = (pos.x + p.x + CHUNK_SIZE_X) % CHUNK_SIZE_X;
                v.y = (pos.y + p.y + CHUNK_SIZE_Y) % CHUNK_SIZE_Y;
                v.z = (pos.z + p.z + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
                if(ax < 0) {
                    chunk = nc.nx.chunk;
                } else if(ay < 0) {
                    chunk = nc.ny.chunk;
                } else if(az < 0) {
                    chunk = nc.nz.chunk;
                } else if(ax >= CHUNK_SIZE_X) {
                    chunk = nc.px.chunk;
                } else if(ay >= CHUNK_SIZE_Y) {
                    chunk = nc.py.chunk;
                } else if(az >= CHUNK_SIZE_Z) {
                    chunk = nc.pz.chunk;
                }
            }
            const b = neighbours[p.name] = chunk.tblocks.get(v, cb);
            const properties = b?.properties;
            if(!properties || properties.transparent || properties.fluid) {
                // @нельзя прерывать, потому что нам нужно собрать всех "соседей"
                neighbours.pcnt--;
            }
            if(properties.is_water) {
                is_water_count++;
            }
        }
        if(is_water_count == 6) {
            neighbours.water_in_water = this.material.is_water;
        }
        return neighbours;
    }

}

// TypedBlocks
class TypedBlocks {

    #neightbours_chunks;

    constructor(coord, chunkSize = null, block_count = CHUNK_SIZE) {
        this.addr       = getChunkAddr(coord);
        this.coord      = coord;
        this.count      = block_count;
        this.id         = new Uint16Array(this.count);
        this.power      = new VectorCollector();
        this.rotate     = new VectorCollector();
        this.entity_id  = new VectorCollector();
        this.texture    = new VectorCollector();
        this.extra_data = new VectorCollector();
        this.vertices   = new VectorCollector();
        this.falling    = new VectorCollector();
        //
        this.shapes     = new VectorCollector();
        this.metadata   = new VectorCollector();
        this.position   = new VectorCollector();
        this.non_zero   = 0;

        this.dataChunk = {
            cx: 1,
            cy: CHUNK_SIZE_X * CHUNK_SIZE_Z,
            cz: CHUNK_SIZE_X,
            cw: 0,
            portals: null,
        };
    }

    //
    getNeightboursChunks(world) {
        if(this.#neightbours_chunks) {
            return this.#neightbours_chunks;
        }
        //
        const nc = this.#neightbours_chunks = {
            // center
            that: {addr: this.addr, chunk: null},
            // sides
            nx: {addr: new Vector$1(this.addr.x - 1, this.addr.y, this.addr.z), chunk: null},
            px: {addr: new Vector$1(this.addr.x + 1, this.addr.y, this.addr.z), chunk: null},
            ny: {addr: new Vector$1(this.addr.x, this.addr.y - 1, this.addr.z), chunk: null},
            py: {addr: new Vector$1(this.addr.x, this.addr.y + 1, this.addr.z), chunk: null},
            nz: {addr: new Vector$1(this.addr.x, this.addr.y, this.addr.z - 1), chunk: null},
            pz: {addr: new Vector$1(this.addr.x, this.addr.y, this.addr.z + 1), chunk: null}
        };
        //
        for(let i in this.#neightbours_chunks) {
            const n = this.#neightbours_chunks[i];
            n.chunk = world.chunkManager.getChunk(n.addr);
        }
        return nc;
    }

    // Restore state
    restoreState(state, refresh_non_zero = false) {
        this.id         = state.id; // new Uint16Array(state.id);
        this.power      = new VectorCollector(state.power.list);
        this.rotate     = new VectorCollector(state.rotate.list);
        this.entity_id  = new VectorCollector(state.entity_id.list);
        this.texture    = new VectorCollector(state.texture.list);
        this.extra_data = new VectorCollector(state.extra_data.list);
        this.vertices   = new VectorCollector(state.vertices.list);
        this.shapes     = new VectorCollector(state.shapes.list);
        this.falling    = new VectorCollector(state.falling.list);
        if(refresh_non_zero) {
            this.refreshNonZero();
        }
    }

    saveState() {
        return this;
    }

    //
    refreshNonZero() {
        this.non_zero = 0;
        for(let i = 0; i < this.count; i++) {
            if(this.id[i] != 0) {
                this.non_zero++;
            }
        }
        return this.non_zero;
    }

    // DIAMOND_ORE // 56
    // REDSTONE_ORE // 73
    // GOLD_ORE // 14
    // IRON_ORE // 15
    // COAL_ORE // 16
    isFilled(id) {
        return (id >= 2 && id <= 3) ||
                id == 9 || id == 56 || id == 73 ||
                (id >= 14 && id <= 16) ||
                (id >= 545 && id <= 550);
    }

    isWater(id) {
        return id == 200 || id == 202;
    }

    //
    blockIsClosed(index, id, x, y, z) {
        const max_count = this.count;
        const i_up = index + CHUNK_SIZE_X * CHUNK_SIZE_Z;
        const i_down = index - CHUNK_SIZE_X * CHUNK_SIZE_Z;
        const i_north = index + CHUNK_SIZE_X;
        const i_south = index - CHUNK_SIZE_X;
        const i_east = index + 1;
        const i_west = index - 1;
        if(i_up < max_count && i_north < max_count && i_east < max_count && i_down > -1 && i_south > -1 && i_west > -1) {
            const is_filled = this.isFilled(id);
            const is_water = false; // this.isWater(id);
            if(is_filled || is_water) {
                const id_up = this.id[i_up];
                const id_down = this.id[i_down];
                const id_north = this.id[i_north];
                const id_south = this.id[i_south];
                const id_west = this.id[i_west];
                const id_east = this.id[i_east];
                if(is_filled) {
                    if(this.isFilled(id_up) && this.isFilled(id_down) && this.isFilled(id_south) && this.isFilled(id_north) && this.isFilled(id_west) && this.isFilled(id_east)) {
                        return true;
                    }
                } /*else if(is_water) {
                    if(this.isWater(id_up) && this.isWater(id_down) && this.isWater(id_south) && this.isWater(id_north) && this.isWater(id_west) && this.isWater(id_east)) {
                        return true;
                    }
                }*/
            }
        }
        return false;
    }

    /**
     * Creating iterator that fill target block to reduce allocations
     * NOTE! This unsafe because returned block will be re-filled in iteration process
     * @param {TBlock} target
     * @returns
     */
    createUnsafeIterator(target = null, ignore_filled = false) {
        const b = target || new TBlock(this, new Vector$1());
        const contex = this;
        return (function* () {
            // if(!globalThis.dfgdfg) globalThis.dfgdfg = 0;
            for(let index = 0; index < contex.count; index++) {
                const id = contex.id[index];
                if (!id) {
                    continue;
                }
                // let index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * y + (z * CHUNK_SIZE_X) + x;
                let x = index % CHUNK_SIZE_X;
                let y = index / (CHUNK_SIZE_X * CHUNK_SIZE_Z) | 0;
                let z = ((index) % (CHUNK_SIZE_X * CHUNK_SIZE_Z) - x) / CHUNK_SIZE_X;
                if(ignore_filled) {
                    if(x > 0 && y > 0 && z > 0 && x < CHUNK_SIZE_X - 1 && y < CHUNK_SIZE_Y - 1 && z < CHUNK_SIZE_Z - 1) {
                        if(contex.blockIsClosed(index, id, x, y, z)) {
                            // globalThis.dfgdfg++
                            continue;
                        }
                    }
                }
                let vec = b.vec.set(x, y, z);
                yield b.init(contex, vec); // new TBlock(this, vec);
            }
            // console.log(globalThis.dfgdfg)
        })()
    }

    *[Symbol.iterator]() {
        for(let index = 0; index < this.count; index++) {
            // let index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * y + (z * CHUNK_SIZE_X) + x;
            let x = index % CHUNK_SIZE_X;
            let y = index / (CHUNK_SIZE_X * CHUNK_SIZE_Z) | 0;
            let z = ((index) % (CHUNK_SIZE_X * CHUNK_SIZE_Z) - x) / CHUNK_SIZE_X;
            let vec = new Vector$1(x, y, z);
            yield new TBlock(this, vec);
        }
    }

    delete(vec) {
        let block           = this.get(vec);
        block.id            = 0;
        block.power         = 0;
        block.rotate        = null;
        block.entity_id     = null;
        block.texture       = null;
        block.extra_data    = null;
        block.vertices      = null;
        block.falling       = null;
        block.shapes        = null;
        block.position      = null;
    }

    /**
     * Get or fill block by it pos
     * @param {Vector} vec
     * @param {TBlock} block
     * @returns
     */
    get(vec, block = null) {
        return block
            ? block.init(this, vec)
            : new TBlock(this, vec);
    }

    has(vec) {
        // const index = BLOCK.getIndex(vec);
        const index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * vec.y + (vec.z * CHUNK_SIZE_X) + vec.x;
        return this.id[index] > 0;
    }

    static _tmp = new Vector$1();

    getBlockId(x, y, z) {
        const { cx, cy, cz, cw } = this.dataChunk;
        const index = cx * x + cy * y + cz * z + cw;
        return this.id[index];
    }

    setBlockRotateExtra(x, y, z, rotate, extra_data) {
        const vec = TypedBlocks._tmp.set(x, y, z);
        if (rotate !== undefined) {
            this.rotate.set(vec, rotate);
        }
        if (extra_data !== undefined) {
            this.extra_data.set(vec, extra_data);
        }
    }

    setBlockId(x, y, z, id) {
        const { cx, cy, cz, cw } = this.dataChunk;
        const index = cx * x + cy * y + cz * z + cw;
        this.id[index] = id;
        return 0;
    }
}

// VectorCollector...
class VectorCollector1D {
    constructor(dims, list) {
        this.dims = dims;
        this.sy = dims.x * dims.z;
        this.sz = dims.x;
        this.clear(list);
    }

    clear(list) {
        this.list = list ? list : new Map();
        this.size = this.list.size;
    }

    set(vec, value) {
        const {sy, sz, list} = this;
        let ind = vec.x + vec.y * sy + vec.z * sz;
        if (typeof value === 'function') {
            value = value(vec);
        }
        list.set(ind, value);
        if (this.size < list.size) {
            this.size = list.size;
            return true;
        }
        return false;
    }

    add(vec, value) {
        const {sy, sz, list} = this;
        let ind = vec.x + vec.y * sy + vec.z * sz;
        if(!list.get(ind)) {
            if (typeof value === 'function') {
                value = value(vec);
            }
            list.set(ind, value);
        }
        this.size = list.size;
        return list.get(ind);
    }

    delete(vec) {
        const {sy, sz, list} = this;
        let ind = vec.x + vec.y * sy + vec.z * sz;
        if(list.delete(ind)) {
            this.size = list.size;
            return true;
        }
        return false;
    }

    has(vec) {
        const {sy, sz, list} = this;
        let ind = vec.x + vec.y * sy + vec.z * sz;
        return list.has(ind) || false;
    }

    get(vec) {
        const {sy, sz, list} = this;
        let ind = vec.x + vec.y * sy + vec.z * sz;
        return list.get(ind) || null;
    }
}

class TypedBlocks2 {

    #neightbours_chunks;

    constructor(coord, chunkSize, block_count = CHUNK_SIZE) {
        this.addr       = getChunkAddr(coord);
        this.coord      = coord;
        this.chunkSize = chunkSize;
        this.count      = block_count;
        this.id         = new Uint16Array(this.count);
        this.power      = new VectorCollector1D(chunkSize);
        this.rotate     = new VectorCollector1D(chunkSize);
        this.entity_id  = new VectorCollector1D(chunkSize);
        this.texture    = new VectorCollector1D(chunkSize);
        this.extra_data = new VectorCollector1D(chunkSize);
        this.vertices   = new VectorCollector1D(chunkSize);
        this.falling    = new VectorCollector1D(chunkSize);
        //
        this.shapes     = new VectorCollector1D(chunkSize);
        this.metadata   = new VectorCollector1D(chunkSize);
        this.position   = new VectorCollector1D(chunkSize);
        this.non_zero   = 0;

        this.dataChunk = {
            cx: 1,
            cy: chunkSize.x * chunkSize.z,
            cz: chunkSize.x,
            cw: 0,
            portals: null,
        };
    }

    //
    getNeightboursChunks(world) {
        if(this.#neightbours_chunks) {
            return this.#neightbours_chunks;
        }
        //
        const nc = this.#neightbours_chunks = {
            // center
            that: {addr: this.addr, chunk: null},
            // sides
            nx: {addr: new Vector$1(this.addr.x - 1, this.addr.y, this.addr.z), chunk: null},
            px: {addr: new Vector$1(this.addr.x + 1, this.addr.y, this.addr.z), chunk: null},
            ny: {addr: new Vector$1(this.addr.x, this.addr.y - 1, this.addr.z), chunk: null},
            py: {addr: new Vector$1(this.addr.x, this.addr.y + 1, this.addr.z), chunk: null},
            nz: {addr: new Vector$1(this.addr.x, this.addr.y, this.addr.z - 1), chunk: null},
            pz: {addr: new Vector$1(this.addr.x, this.addr.y, this.addr.z + 1), chunk: null}
        };
        //
        for(let i in this.#neightbours_chunks) {
            const n = this.#neightbours_chunks[i];
            n.chunk = world.chunkManager.getChunk(n.addr);
        }
        return nc;
    }

    // Restore state
    restoreState(state, refresh_non_zero = false) {
        const {chunkSize} = this;
        this.id         = state.id; // new Uint16Array(state.id);
        this.power      = new VectorCollector1D(chunkSize, state.power.list);
        this.rotate     = new VectorCollector1D(chunkSize, state.rotate.list);
        this.entity_id  = new VectorCollector1D(chunkSize, state.entity_id.list);
        this.texture    = new VectorCollector1D(chunkSize, state.texture.list);
        this.extra_data = new VectorCollector1D(chunkSize, state.extra_data.list);
        this.vertices   = new VectorCollector1D(chunkSize, state.vertices.list);
        this.shapes     = new VectorCollector1D(chunkSize, state.shapes.list);
        this.falling    = new VectorCollector1D(chunkSize, state.falling.list);
        if(refresh_non_zero) {
            this.refreshNonZero();
        }
    }

    saveState() {
        return this;
    }

    //
    refreshNonZero() {
        this.non_zero = 0;
        for(let i = 0; i < this.count; i++) {
            if(this.id[i] != 0) {
                this.non_zero++;
            }
        }
        return this.non_zero;
    }

    // DIAMOND_ORE // 56
    // REDSTONE_ORE // 73
    // GOLD_ORE // 14
    // IRON_ORE // 15
    // COAL_ORE // 16
    isFilled(id) {
        return (id >= 2 && id <= 3) ||
                id == 9 || id == 56 || id == 73 ||
                (id >= 14 && id <= 16) ||
                (id >= 545 && id <= 550);
    }

    isWater(id) {
        return id == 200 || id == 202;
    }

    //
    blockIsClosed(index, id, x, y, z) {
        const max_count = this.count;
        const i_up = index + CHUNK_SIZE_X * CHUNK_SIZE_Z;
        const i_down = index - CHUNK_SIZE_X * CHUNK_SIZE_Z;
        const i_north = index + CHUNK_SIZE_X;
        const i_south = index - CHUNK_SIZE_X;
        const i_east = index + 1;
        const i_west = index - 1;
        if(i_up < max_count && i_north < max_count && i_east < max_count && i_down > -1 && i_south > -1 && i_west > -1) {
            const is_filled = this.isFilled(id);
            const is_water = false; // this.isWater(id);
            if(is_filled || is_water) {
                const id_up = this.id[i_up];
                const id_down = this.id[i_down];
                const id_north = this.id[i_north];
                const id_south = this.id[i_south];
                const id_west = this.id[i_west];
                const id_east = this.id[i_east];
                if(is_filled) {
                    if(this.isFilled(id_up) && this.isFilled(id_down) && this.isFilled(id_south) && this.isFilled(id_north) && this.isFilled(id_west) && this.isFilled(id_east)) {
                        return true;
                    }
                } /*else if(is_water) {
                    if(this.isWater(id_up) && this.isWater(id_down) && this.isWater(id_south) && this.isWater(id_north) && this.isWater(id_west) && this.isWater(id_east)) {
                        return true;
                    }
                }*/
            }
        }
        return false;
    }

    /**
     * Creating iterator that fill target block to reduce allocations
     * NOTE! This unsafe because returned block will be re-filled in iteration process
     * @param {TBlock} target
     * @returns
     */
    createUnsafeIterator(target = null, ignore_filled = false) {
        const b = target || new TBlock(this, new Vector$1());
        const contex = this;
        return (function* () {
            // if(!globalThis.dfgdfg) globalThis.dfgdfg = 0;
            for(let index = 0; index < contex.count; index++) {
                const id = contex.id[index];
                if (!id) {
                    continue;
                }
                // let index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * y + (z * CHUNK_SIZE_X) + x;
                let x = index % CHUNK_SIZE_X;
                let y = index / (CHUNK_SIZE_X * CHUNK_SIZE_Z) | 0;
                let z = ((index) % (CHUNK_SIZE_X * CHUNK_SIZE_Z) - x) / CHUNK_SIZE_X;
                if(ignore_filled) {
                    if(x > 0 && y > 0 && z > 0 && x < CHUNK_SIZE_X - 1 && y < CHUNK_SIZE_Y - 1 && z < CHUNK_SIZE_Z - 1) {
                        if(contex.blockIsClosed(index, id, x, y, z)) {
                            // globalThis.dfgdfg++
                            continue;
                        }
                    }
                }
                let vec = b.vec.set(x, y, z);
                yield b.init(contex, vec); // new TBlock(this, vec);
            }
            // console.log(globalThis.dfgdfg)
        })()
    }

    *[Symbol.iterator]() {
        for(let index = 0; index < this.count; index++) {
            // let index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * y + (z * CHUNK_SIZE_X) + x;
            let x = index % CHUNK_SIZE_X;
            let y = index / (CHUNK_SIZE_X * CHUNK_SIZE_Z) | 0;
            let z = ((index) % (CHUNK_SIZE_X * CHUNK_SIZE_Z) - x) / CHUNK_SIZE_X;
            let vec = new Vector$1(x, y, z);
            yield new TBlock(this, vec);
        }
    }

    delete(vec) {
        let block           = this.get(vec);
        block.id            = null;
        block.power         = 0;
        block.rotate        = null;
        block.entity_id     = null;
        block.texture       = null;
        block.extra_data    = null;
        block.vertices      = null;
        block.falling       = null;
        block.shapes        = null;
        block.position      = null;
    }

    /**
     * Get or fill block by it pos
     * @param {Vector} vec
     * @param {TBlock} block
     * @returns
     */
    get(vec, block = null) {
        //TODO: are we sure that vec wont be modified?
        const { cx, cy, cz } = this;
        const index = cy * vec.y + cz * vec.z + cx * vec.x;
        return block
            ? block.init(this, vec, index)
            : new TBlock(this, vec, index);
    }

    has(vec) {
        const { cx, cy, cz } = this;
        const index = cy * vec.y + cz * vec.z + cx * vec.x;
        return this.id[index] > 0;
    }

    static _tmp = new Vector$1();

    getBlockId(x, y, z) {
        const { cx, cy, cz, cw } = this.dataChunk;
        const index = cx * x + cy * y + cz * z + cw;
        return this.id[index];
    }

    setBlockRotateExtra(x, y, z, rotate, extra_data) {
        const vec = TypedBlocks2._tmp.set(x, y, z);
        if (rotate !== undefined) {
            this.rotate.set(vec, rotate);
        }
        if (extra_data !== undefined) {
            this.extra_data.set(vec, extra_data);
        }
    }

    setBlockId(x, y, z, id) {
        const { cx, cy, cz, cw } = this.dataChunk;
        const index = cx * x + cy * y + cz * z + cw;
        this.id[index] = id;
        return 0;
    }
}

const tempAABB = new AABB();

class BaseChunk {
    constructor({size}) {
        this.outerAABB = new AABB();
        this.safeAABB = new AABB();
        this.pos = new Vector$1();
        this.subRegions = [];
        this.subMaxWidth = 0;
        this.portals = [];
        this.initSize(size);
        this.setPos(Vector$1.ZERO);
        this.dif26 = [];
        this.rev = null;
    }

    initSize(size) {
        const padding = this.padding = 1;
        this.size = size;
        const outerSize = this.outerSize = new Vector$1(size.x + padding * 2, size.y + padding * 2, size.z + padding * 2);
        this.aabb = new AABB();
        this.outerLen = outerSize.x * outerSize.y * outerSize.z;
        this.insideLen = size.x * size.y * size.z;
        this.outerAABB = new AABB();
        this.safeAABB = new AABB();
        this.shiftCoord = 0;

        this.cx = 1;
        this.cy = outerSize.x * outerSize.z;
        this.cz = outerSize.x;
        this.cw = padding * (this.cx + this.cy + this.cz);
    }

    /**
     *
     * @param {Vector} pos
     * @returns {BaseChunk}
     */
    setPos(pos) {
        const {size, padding, outerSize} = this;
        this.pos.copyFrom(pos);
        this.aabb.set(pos.x, pos.y, pos.z, pos.x + size.x, pos.y + size.y, pos.z + size.z);
        const outer = this.outerAABB.copyFrom(this.aabb).pad(padding);
        this.safeAABB.copyFrom(this.aabb).pad(-1);
        this.shiftCoord = -(outer.x_min + outerSize.x * (outer.z_min + outerSize.z * outer.y_min));
        return this;
    }

    addSub(sub) {
        const {subRegions} = this;
        const x = sub.aabb.x_min;
        let i = 0, len = subRegions.length;
        for (; i < len; i++) {
            if (subRegions[i].aabb.x_min > x) {
                break;
            }
        }
        for (let j = len - 1; j >= i; j--) {
            subRegions[j + 1] = subRegions[j];
        }
        subRegions[i] = sub;

        this.subMaxWidth = Math.max(this.subMaxWidth, sub.aabb.x_max - sub.aabb.x_min);
        sub._addPortalsForBase(this);
    }

    removeSub(sub) {
        let ind = this.subRegions.indexOf(sub);
        if (ind >= 0) {
            sub._removeAllPortals();
            this.subRegions.splice(ind, 1);
        }
    }

    subByWorld(worldCoord) {
        const {subRegions, subMaxWidth} = this;
        const {x, y, z} = worldCoord;
        // easy binary search part 1
        let left = 0, right = subRegions.length;
        while (left + 1 < right) {
            let mid = (left + right) >> 1;
            if (subRegions[mid].aabb.x_min + subMaxWidth < x) {
                left = mid;
            } else {
                right = mid;
            }
        }
        let L = right;
        left = L;
        right = subRegions.length;
        while (left + 1 < right) {
            let mid = (left + right) >> 1;
            if (subRegions[mid].aabb.x_min <= x) {
                left = mid;
            } else {
                right = mid;
            }
        }
        let R = right;

        for (let i = L; i < R; i++) {
            const sub = subRegions[i].aabb;
            if (sub.x_min <= x && x <= sub.x_max
                && sub.y_min <= y && y <= sub.y_max
                && sub.z_min <= z && z <= sub.z_max) {
                return sub;
            }
        }
        return null;
    }

    /**
     *
     * @param {number} outerCoord
     */
    subByOuter(outerCoord) {

    }

    _addPortal(portal) {
        this.portals.push(portal);

        const inner = this.safeAABB;
        const aabb = portal.aabb;
        tempAABB.setIntersect(inner, aabb);
        if (tempAABB.isEmpty()) {
            return;
        }
        if (tempAABB.width <= tempAABB.height && tempAABB.width <= tempAABB.depth) {
            if (inner.x_min < aabb.x_min && inner.x_max <= aabb.x_max) {
                inner.x_max = aabb.x_min;
            } else {
                inner.x_min = aabb.x_max;
            }
        } else if (tempAABB.height <= tempAABB.width && tempAABB.height <= tempAABB.depth) {
            if (inner.y_min < aabb.y_min) {
                inner.y_max = aabb.y_min;
            } else {
                inner.y_min = aabb.y_max;
            }
        } else {
            if (inner.z_min < aabb.z_min) {
                inner.z_max = aabb.z_min;
            } else {
                inner.z_min = aabb.z_max;
            }
        }
    }

    _addPortalsForBase(baseChunk) {
        const {subRegions, subMaxWidth} = baseChunk;
        let left = -1, right = subRegions.length;
        const {x_min, x_max, y_min, y_max, z_min, z_max} = this.aabb;

        // easy binary search part 2
        while (left + 1 < right) {
            let mid = (left + right) >> 1;
            if (subRegions[mid].aabb.x_min + subMaxWidth < x_min) {
                left = mid;
            } else {
                right = mid;
            }
        }
        let L = right;
        left = L;
        right = subRegions.length;
        while (left + 1 < right) {
            let mid = (left + right) >> 1;
            if (subRegions[mid].aabb.x_min <= x_max) {
                left = mid;
            } else {
                right = mid;
            }
        }
        let R = right;

        for (let i = L; i < R; i++) {
            const second = subRegions[i];
            if (second === this) {
                continue;
            }
            const neib = subRegions[i].aabb;
            if (neib.x_min <= x_max && x_min <= neib.x_max
                && neib.y_min <= y_max && y_min <= neib.y_max
                && neib.z_min <= z_max && z_min <= neib.z_max) {
                const aabb = new AABB().setIntersect(this.outerAABB, second.outerAABB);
                const portal1 = new Portal({
                    aabb,
                    fromRegion: this,
                    toRegion: second
                });
                const portal2 = new Portal({
                    aabb,
                    fromRegion: second,
                    toRegion: this
                });
                portal1.rev = portal2;
                portal2.rev = portal1;
                this._addPortal(portal1);
                second._addPortal(portal2);
            }
        }
    }

    _removeAllPortals() {
        for (let i = 0; i < this.portals.length; i++) {
            const portal = this.portals[i];
            const {rev} = portal;
            const ind = rev.fromRegion.portals.indexOf(rev);
            if (ind >= 0) {
                rev.fromRegion.portals.splice(ind, 1);
            } else {
                // WTF?
            }
        }
        this.portals.length = 0;
    }
}

class Portal {
    constructor({aabb, fromRegion, toRegion}) {
        this.aabb = aabb;
        this.fromRegion = fromRegion;
        this.toRegion = toRegion;
    }
}

class DataChunk extends BaseChunk {
    constructor({size, strideBytes}) {
        super({size});
        this.initData(strideBytes);
    }

    initData(strideBytes) {
        this.strideBytes = strideBytes;
        this.stride32 = strideBytes >> 2;
        this.stride16 = strideBytes >> 1;
        this.dataBuf = new ArrayBuffer(this.outerLen * strideBytes);
        this.uint8View = new Uint8Array(this.dataBuf);
        if ((strideBytes & 1) === 0) {
            this.uint16View = new Uint16Array(this.dataBuf);
        }
        if ((strideBytes & 3) === 0) {
            this.uint32View = new Uint32Array(this.dataBuf);
        }
    }

    setFromArrayBuffer(buf) {
        // only not-padded data
        if (buf.byteLength !== this.strideBytes * this.insideLen) {
            throw new Error('Wrong data size');
        }
        let { outerSize, size, padding, strideBytes, stride32, uint8View, uint32View } = this;
        if (uint32View) {
            const data = new Uint32Array(buf);
            const amount = size.x * stride32;
            for (let y = 0; y < size.y; y++) {
                for (let z = 0; z < size.z; z++) {
                    const indFrom = (y * size.z + z) * size.x * stride32;
                    const indTo = (((y + padding) * outerSize.z + (z + padding)) * outerSize.x + padding) * strideBytes;
                    for (let x = 0; x < amount; x++) {
                        this.uint32View[indTo + x] = data[indFrom + x];
                    }
                }
            }
        } else {
            const data = new Uint8Array(buf);
            const amount = size.x * strideBytes;
            for (let y = 0; y < size.y; y++) {
                for (let z = 0; z < size.z; z++) {
                    const indFrom = (y * size.z + z) * size.x * strideBytes;
                    const indTo = (((y + padding) * outerSize.z + (z + padding)) * outerSize.x + padding) * strideBytes;
                    for (let x = 0; x < amount; x++) {
                        this.uint8View[indTo + x] = data[indFrom + x];
                    }
                }
            }
        }
    }

    uint32ByCoord(localX, localY, localZ, offset = 0) {
        const { outerSize, padding, stride32, uint32View } = this;
        localX += padding;
        localY += padding;
        localZ += padding;
        return uint32View[offset + stride32 * (localX  + outerSize.x * (localZ + localY * outerSize.z))];
    }

    uint16ByCoord(localX, localY, localZ, offset = 0) {
        const { outerSize, padding, stride16, uint16View } = this;
        localX += padding;
        localY += padding;
        localZ += padding;
        return uint16View[offset + stride16 * (localX  + outerSize.x * (localZ + localY * outerSize.z))];
    }

    indexByWorld(worldX, worldY, worldZ) {
        const { outerSize } = this;
        return worldX + outerSize.x * (worldZ + outerSize.z * worldY) + this.shiftCoord;
    }
    setUint32ByCoord(localX, localY, localZ, offset, value) {
        const { outerSize, padding, stride32, uint32View } = this;
        localX += padding;
        localY += padding;
        localZ += padding;
        uint32View[offset + stride32 * (localX  + outerSize.x * (localZ + localY * outerSize.z))] = value;
    }

    uint8ByInd(ind, offset) {
        return this.uint8View[ind * this.strideBytes + offset];
    }

    setUint8ByInd(ind, offset, value) {
        this.uint8View[ind * this.strideBytes + offset] = value;
    }
}

function newTypedBlocks(x, y, z) {
    return new TypedBlocks3(x, y, z);
}

class TypedBlocks3 {

    #neightbours_chunks;

    constructor(coord, chunkSize) {
        this.addr       = getChunkAddr(coord);
        this.coord      = coord;
        this.chunkSize = chunkSize;
        this.power      = new VectorCollector1D(chunkSize);
        this.rotate     = new VectorCollector1D(chunkSize);
        this.entity_id  = new VectorCollector1D(chunkSize);
        this.texture    = new VectorCollector1D(chunkSize);
        this.extra_data = new VectorCollector1D(chunkSize);
        this.vertices   = new VectorCollector1D(chunkSize);
        this.falling    = new VectorCollector1D(chunkSize);
        //
        this.shapes     = new VectorCollector1D(chunkSize);
        this.metadata   = new VectorCollector1D(chunkSize);
        this.position   = new VectorCollector1D(chunkSize);
        this.non_zero   = 0;

        this.dataChunk = new DataChunk({ size: chunkSize, strideBytes: 2 }).setPos(coord);
        this.id = this.dataChunk.uint16View;
    }

    //
    getNeightboursChunks(world) {
        if(this.#neightbours_chunks) {
            return this.#neightbours_chunks;
        }
        //
        const nc = this.#neightbours_chunks = {
            // center
            that: {addr: this.addr, chunk: null},
            // sides
            nx: {addr: new Vector$1(this.addr.x - 1, this.addr.y, this.addr.z), chunk: null},
            px: {addr: new Vector$1(this.addr.x + 1, this.addr.y, this.addr.z), chunk: null},
            ny: {addr: new Vector$1(this.addr.x, this.addr.y - 1, this.addr.z), chunk: null},
            py: {addr: new Vector$1(this.addr.x, this.addr.y + 1, this.addr.z), chunk: null},
            nz: {addr: new Vector$1(this.addr.x, this.addr.y, this.addr.z - 1), chunk: null},
            pz: {addr: new Vector$1(this.addr.x, this.addr.y, this.addr.z + 1), chunk: null}
        };
        //
        for(let i in this.#neightbours_chunks) {
            const n = this.#neightbours_chunks[i];
            n.chunk = world.chunkManager.getChunk(n.addr);
        }
        return nc;
    }

    // Restore state
    restoreState(state, refresh_non_zero = false) {
        const {chunkSize} = this;

        this.dataChunk.uint16View.set(state.id, 0);
        this.power      = new VectorCollector1D(chunkSize, state.power);
        this.rotate     = new VectorCollector1D(chunkSize, state.rotate);
        this.entity_id  = new VectorCollector1D(chunkSize, state.entity_id);
        this.texture    = new VectorCollector1D(chunkSize, state.texture);
        this.extra_data = new VectorCollector1D(chunkSize, state.extra_data);
        this.vertices   = new VectorCollector1D(chunkSize, state.vertices);
        this.shapes     = new VectorCollector1D(chunkSize, state.shapes);
        this.falling    = new VectorCollector1D(chunkSize, state.falling);
        if(refresh_non_zero) {
            this.refreshNonZero();
        }
    }

    saveState() {
        return {
            id: this.dataChunk.uint16View,
            power: this.power.list,
            rotate: this.rotate.list,
            entity_id: this.entity_id.list,
            texture: this.texture.list,
            extra_data: this.extra_data.list,
            vertices: this.vertices.list,
            shapes: this.shapes.list,
            falling: this.falling.list,
        }
    }

    //
    refreshNonZero() {
        this.non_zero = 0;
        const id = this.dataChunk.uint16View;
        const len = id.length;
        for(let i = 0; i < len; i++) {
            if(id[i] !== 0) {
                this.non_zero++;
            }
        }
        return this.non_zero;
    }

    // DIAMOND_ORE // 56
    // REDSTONE_ORE // 73
    // GOLD_ORE // 14
    // IRON_ORE // 15
    // COAL_ORE // 16
    isFilled(id) {
        return (id >= 2 && id <= 3) ||
                id == 9 || id == 56 || id == 73 ||
                (id >= 14 && id <= 16) ||
                (id >= 545 && id <= 550);
    }

    isWater(id) {
        return id == 200 || id == 202;
    }

    //
    blockIsClosed(index, id, x, y, z) {
        const { cx, cy, cz, cw } = this.dataChunk;
        index = cx * x + cy * y + cz * z + cw;
        const i_up = index + cy;
        const i_down = index - cy;
        const i_north = index + cz;
        const i_south = index - cz;
        const i_east = index + cx;
        const i_west = index - cx;
        const is_filled = this.isFilled(id);
        const is_water = false; // this.isWater(id);
        if(is_filled || is_water) {
            // assume stride16 is 1
            const id_up = this.id[i_up];
            const id_down = this.id[i_down];
            const id_north = this.id[i_north];
            const id_south = this.id[i_south];
            const id_west = this.id[i_west];
            const id_east = this.id[i_east];
            if(is_filled) {
                if(this.isFilled(id_up) && this.isFilled(id_down) && this.isFilled(id_south) && this.isFilled(id_north) && this.isFilled(id_west) && this.isFilled(id_east)) {
                    return true;
                }
            } /*else if(is_water) {
                if(this.isWater(id_up) && this.isWater(id_down) && this.isWater(id_south) && this.isWater(id_north) && this.isWater(id_west) && this.isWater(id_east)) {
                    return true;
                }
            }*/
        }
        return false;
    }

    /**
     * Creating iterator that fill target block to reduce allocations
     * NOTE! This unsafe because returned block will be re-filled in iteration process
     * @param {TBlock} target
     * @returns
     */
    createUnsafeIterator(target = null, ignore_filled = false) {
        const b = target || new TBlock(this, new Vector$1());
        const { size, uint16View, cx, cy, cz, cw } = this.dataChunk;
        const contex = b.tb = this;
        return (function* () {
            // if(!globalThis.dfgdfg) globalThis.dfgdfg = 0;
            for (let y = 0; y < size.y; y++)
                for (let z = 0; z < size.z; z++)
                    for (let x = 0; x < size.x; x++) {
                        const index = cx * x + cy * y + cz * z + cw;
                        const id = uint16View[index];
                        if (!id) continue;
                        if (ignore_filled && contex.blockIsClosed(index, id, x, y, z)) {
                            continue;
                        }
                        b.index = index;
                        b.vec.set(x, y, z);
                        yield b;
                    }
            // console.log(globalThis.dfgdfg)
        })()
    }

    *[Symbol.iterator]() {
        const { size } = this.dataChunk;
        const { cx, cy, cz, cw } = this;
        for (let y = 0; y < size.y; y++)
            for (let z = 0; z < size.z; z++)
                for (let x = 0; x < size.x; x++) {
                    const index = cx * x + cy * y + cz * z + cw;
                    let vec = new Vector$1(x, y, z);
                    yield new TBlock(this, vec, index);
                }
    }

    delete(vec) {
        let block           = this.get(vec);
        block.id            = null;
        block.power         = 0;
        block.rotate        = null;
        block.entity_id     = null;
        block.texture       = null;
        block.extra_data    = null;
        block.vertices      = null;
        block.falling       = null;
        block.shapes        = null;
        block.position      = null;
    }

    /**
     * Get or fill block by it pos
     * @param {Vector} vec
     * @param {TBlock} block
     * @returns
     */
    get(vec, block = null) {
        //TODO: are we sure that vec wont be modified?
        const { cx, cy, cz, cw } = this.dataChunk;
        const index = cx * vec.x + cy * vec.y + cz * vec.z + cw;
        return block
            ? block.init(this, vec, index)
            : new TBlock(this, vec, index);
    }

    has(vec) {
        const { cx, cy, cz, cw } = this.dataChunk;
        const index = cx * vec.x + cy * vec.y + cz * vec.z + cw;
        return this.id[index] > 0;
    }

    static _prt = [];

    getNeighbours(tblock, world, cache) {
        const { portals, safeAABB, pos, outerSize } = this.dataChunk;
        const cx = 1, cy = outerSize.x * outerSize.z, cz = outerSize.x;
        const localPos = tblock.vec;
        const wx = localPos.x + pos.x, wy = localPos.y + pos.y, wz = localPos.z + pos.z;

        if (safeAABB.contains(wx, wy, wz)) {
            for (let dir = 0; dir < CC.length; dir++) {
                const p = CC[dir];
                const cb = cache[dir];
                cb.tb = this;
                cb.vec.x = localPos.x + p.x;
                cb.vec.y = localPos.y + p.y;
                cb.vec.z = localPos.z + p.z;
                cb.index = tblock.index + cx * p.x + cy * p.y + cz * p.z;
            }
        } else {
            //TODO: here we need only 6 portals, not potential 26
            let known = TypedBlocks3._prt;
            let pcnt = 0;
            for (let i = 0; i < portals.length; i++) {
                if (portals[i].aabb.contains(wx, wy, wz)) {
                    known[pcnt++] = portals[i];
                }
            }
            for (let dir = 0; dir < CC.length; dir++) {
                const p = CC[dir];
                const cb = cache[dir];

                const nx = wx + p.x;
                const ny = wy + p.y;
                const nz = wz + p.z;

                cb.tb = null;
                for (let i = 0; i < pcnt; i++) {
                    const ndata = known[i].toRegion;
                    if (ndata.aabb.contains(nx, ny, nz)) {
                        cb.tb = ndata.rev.tblocks;
                        cb.vec.x = nx - ndata.pos.x;
                        cb.vec.y = ny - ndata.pos.y;
                        cb.vec.z = nz - ndata.pos.z;
                        cb.index = ndata.indexByWorld(nx, ny, nz);
                        break;
                    }
                }

                if (!cb.tb) {
                    cb.tb = this;
                    cb.vec.x = localPos.x + p.x;
                    cb.vec.y = localPos.y + p.y;
                    cb.vec.z = localPos.z + p.z;
                    cb.index = tblock.index + cx * p.x + cy * p.y + cz * p.z;
                }
            }
            for (let i = 0; i < known.length; i++) {
                known[i] = null;
            }
        }

        const neighbours = new BlockNeighbours();
        let is_water_count = 0;
        for (let dir = 0; dir < CC.length; dir++) {
            const cb = cache[dir];
            neighbours[CC[dir].name] = cb;
            const properties = cb?.properties;
            if(!properties || properties.transparent || properties.fluid) {
                // @нельзя прерывать, потому что нам нужно собрать всех "соседей"
                neighbours.pcnt--;
            }
            if(properties.is_water) {
                is_water_count++;
            }
        }
        if(is_water_count == 6) {
            neighbours.water_in_water = tblock.material.is_water;
        }

        return neighbours;
    }

    static _tmp = new Vector$1();

    getBlockId(x, y, z) {
        const { cx, cy, cz, cw } = this.dataChunk;
        const index = cx * x + cy * y + cz * z + cw;
        return this.id[index];
    }

    setBlockRotateExtra(x, y, z, rotate, extra_data) {
        const vec = TypedBlocks3._tmp.set(x, y, z);
        if (rotate !== undefined) {
            this.rotate.set(vec, rotate);
        }
        if (extra_data !== undefined) {
            this.extra_data.set(vec, extra_data);
        }
    }

    setBlockId(x, y, z, id) {
        const { cx, cy, cz, cw, portals, pos, safeAABB } = this.dataChunk;
        const index = cx * x + cy * y + cz * z + cw;
        this.id[index] = id;

        const wx = x + pos.x;
        const wy = y + pos.y;
        const wz = z + pos.z;
        if (safeAABB.contains(wx, wy, wz)) {
            return 0;
        }
        let pcnt = 0;
        //TODO: use only face-portals
        for (let i = 0; i < portals.length; i++) {
            if (portals[i].aabb.contains(wx, wy, wz)) {
                const other = portals[i].toRegion;
                other.uint16View[other.indexByWorld(wx, wy, wz)] = id;
                pcnt++;
            }
        }

        return pcnt;
    }
}

class DataWorld {
    constructor() {
        const INF = 1000000000;
        this.base = new BaseChunk({size: new Vector$1(INF, INF, INF)})
            .setPos(new Vector$1(-INF / 2, -INF / 2, -INF / 2));
    }

    addChunk(chunk) {
        if (!chunk) {
            return;
        }
        chunk.dataChunk = chunk.tblocks.dataChunk;
        if (!chunk.dataChunk.portals) {
            return;
        }
        chunk.dataChunk.rev = chunk;
        this.base.addSub(chunk.dataChunk);
    }

    removeChunk(chunk) {
        if (!chunk || !chunk.dataChunk || !chunk.dataChunk.portals) {
            return;
        }
        this.base.removeSub(chunk.dataChunk);
    }

    /**
     * store blocks of other chunks that are seen in this chunk
     */
    syncOuter(chunk) {
        if (!chunk || !chunk.dataChunk.portals) {
            return;
        }

        const { portals, aabb, uint16View, cx, cy, cz } = chunk.dataChunk;
        const cw = chunk.dataChunk.shiftCoord;
        const tempAABB = new AABB();
        for (let i = 0; i < portals.length; i++) {
            const portal = portals[i];
            const other = portals[i].toRegion;
            const otherView = other.uint16View;

            const cx2 = other.cx;
            const cy2 = other.cy;
            const cz2 = other.cz;
            const cw2 = other.shiftCoord;

            tempAABB.setIntersect(aabb, portal.aabb);
            for (let y = tempAABB.y_min; y < tempAABB.y_max; y++)
                for (let z = tempAABB.z_min; z < tempAABB.z_max; z++)
                    for (let x = tempAABB.x_min; x < tempAABB.x_max; x++) {
                        otherView[x * cx2 + y * cy2 + z * cz2 + cw2] = uint16View[x * cx + y * cy + z * cz + cw];
                    }
            tempAABB.setIntersect(other.aabb, portal.aabb);
            for (let y = tempAABB.y_min; y < tempAABB.y_max; y++)
                for (let z = tempAABB.z_min; z < tempAABB.z_max; z++)
                    for (let x = tempAABB.x_min; x < tempAABB.x_max; x++) {
                        uint16View[x * cx + y * cy + z * cz + cw] = otherView[x * cx2 + y * cy2 + z * cz2 + cw2];
                    }
        }
    }

    /**
     * sets block here and in other chunks
     *
     * @param chunk
     * @param x
     * @param y
     * @param z
     * @param id
     * @returns {number} of portals to other chunks
     */
    setChunkBlock(chunk, x, y, z, id) {
        return chunk.dataChunk.setBlockId(x, y, z, id);
    }
}

const NEAR_MASK_MAX_DIST = 10;
const CLUSTER_SIZE       = new Vector$1(128, 128, 128);
const CLUSTER_PADDING    = 8;
const temp_vec2                 = new Vector$1(0, 0, 0);

class ClusterPoint {

    constructor(height, block_id, margin, info, building, y_shift) {
        this.height         = height;
        this.block_id       = block_id;
        this.margin         = margin;
        this.info           = info;
        this.building       = building;
        this.height_fixed   = false;
        this.hidden         = false;
        this.y_shift        = y_shift | 0;
    }

}

// ClusterBase
class ClusterBase {

    // constructor
    constructor(clusterManager, addr) {
        this.clusterManager = clusterManager;
        this.addr           = addr;
        this.coord          = addr.clone().multiplyVecSelf(CLUSTER_SIZE);
        this.size           = CLUSTER_SIZE.clone();
        this.id             = this.clusterManager.seed + '_' + addr.toHash();
        this.randoms        = new impl(`villages_${this.id}`);
        this.is_empty       = this.addr.y != 0 || this.randoms.double() > 1/4;
        this.mask           = new Array(CLUSTER_SIZE.x * CLUSTER_SIZE.z);
        this.max_height     = null;
        this.max_dist       = NEAR_MASK_MAX_DIST;
    }

    // Set block
    setBlock(chunk, x, y, z, block_id, rotate, extra_data) {
        if(x >= 0 && y >= 0 && z >= 0 && x < CHUNK_SIZE_X && y < CHUNK_SIZE_Y && z < CHUNK_SIZE_Z) {
            // ok
        } else {
            return false;
        }
        const { cx, cy, cz, cw } = chunk.dataChunk;
        const index = cx * x + cy * y + cz * z + cw;
        temp_vec2.x = x;
        temp_vec2.y = y;
        temp_vec2.z = z;
        if(rotate) {
            chunk.tblocks.rotate.set(temp_vec2, rotate);
        }
        if(extra_data) {
            chunk.tblocks.extra_data.set(temp_vec2, extra_data);
        }
        chunk.tblocks.id[index] = block_id;
        return true;
    }

    // Return block from pos
    getBlock(chunk, x, y, z) {
        const {cx, cy, cz, cw} = chunk.dataChunk;
        const index = cx * x + cy * y + cz * z + cw;
        return chunk.tblocks.id[index];
    }

    moveToRandomCorner() {
        const resp = new Vector$1(0, 0, 0);
        if(this.is_empty) {
            return resp;
        }
        let corner = Math.floor(this.randoms.double() * 4);
        let min_x = this.size.x;
        let min_z = this.size.z;
        let max_x = 0;
        let max_z = 0;
        for(let index in this.mask) {
            const value = this.mask[index];
            if(value && (Array.isArray(value.block_id) || value.block_id > 0)) {
                const x = index % this.size.x;
                const z = Math.floor(index / this.size.x);
                if(x < min_x) min_x = x;
                if(z < min_z) min_z = z;
                if(x > max_x) max_x = x;
                if(z > max_z) max_z = z;
            }
        }
        let move_x = 0;
        let move_z = 0;
        switch(corner) {
            case 0: {
                move_x = -min_x + CLUSTER_PADDING;
                move_z = -min_z + CLUSTER_PADDING;
                break;
            }
            case 1: {
                move_x = this.size.x - max_x - CLUSTER_PADDING;
                move_z = -min_z + CLUSTER_PADDING;
                break;
            }
            case 2: {
                move_x = this.size.x - max_x - CLUSTER_PADDING;
                move_z = this.size.z - max_z - CLUSTER_PADDING;
                break;
            }
            case 3: {
                move_x = -min_x + CLUSTER_PADDING;
                move_z = this.size.z - max_z - CLUSTER_PADDING;
                break;
            }
        }
        // make new mask
        const new_mask = new Array(CLUSTER_SIZE.x * CLUSTER_SIZE.z);
        this.near_mask = new Array(CLUSTER_SIZE.x * CLUSTER_SIZE.z).fill(255);
        for(let x = 0; x < this.size.x; x++) {
            for(let z = 0; z < this.size.z; z++) {
                const index = z * this.size.x + x;
                const value = this.mask[index];
                if(value && (Array.isArray(value.block_id) || value.block_id > 0)) {
                    const new_x = x + move_x;
                    const new_z = z + move_z;
                    const new_index = new_z * this.size.x + new_x;
                    new_mask[new_index] = value;
                    for(let i = -NEAR_MASK_MAX_DIST; i < NEAR_MASK_MAX_DIST; i++) {
                        for(let j = -NEAR_MASK_MAX_DIST; j < NEAR_MASK_MAX_DIST; j++) {
                            const dx = new_x + i;
                            const dz = new_z + j;
                            if(dx > -1 && dz > -1 && dx < this.size.x && dz < this.size.z) {
                                const nidx = dz * this.size.x + dx;
                                const dist = Math.sqrt(Math.pow(dx - new_x, 2) + Math.pow(dz - new_z, 2));
                                if(this.near_mask[nidx] > dist && dist <= NEAR_MASK_MAX_DIST) {
                                    this.near_mask[nidx] = dist;
                                }
                            }
                        }
                    }
                }
            }
        }
        this.mask = new_mask;
        resp.x = move_x;
        resp.z = move_z;
        return resp;
    }

    //
    createPalette(list) {
        let that = this;
        let resp = {
            list: list,
            reset: function() {
                this.randoms = new impl(that.id);
            },
            next: function() {
                const r = this.randoms.double();
                for(let item of this.list) {
                    if (r <= item.chance) {
                        return item.value;
                    }
                }
                throw 'Proportional fill pattern';
            }
        };
        return resp;
    }

    // Fill chunk blocks
    fillBlocks(maps, chunk, map) {
        if(this.is_empty) {
            return false;
        }
        const START_X           = chunk.coord.x - this.coord.x;
        const START_Z           = chunk.coord.z - this.coord.z;
        const CHUNK_Y_BOTTOM    = chunk.coord.y;
        //
        // this.road_block.reset();
        // fill roards and basements
        for(let i = 0; i < CHUNK_SIZE_X; i++) {
            for(let j = 0; j < CHUNK_SIZE_Z; j++) {
                let x       = START_X + i;
                let z       = START_Z + j;
                let point   = this.mask[z * CLUSTER_SIZE.x + x];
                if(point && point.height) {
                    if(point.block_id == 0) {
                        continue;
                    }
                    const cell = map.cells[j * CHUNK_SIZE_X + i];
                    if(cell.biome.code == 'OCEAN') {
                        /*if(this.use_road_as_gangway && point.block_id == this.road_block) {
                            let y = WATER_LINE - CHUNK_Y_BOTTOM - 1;
                            if(y >= 0 && y < CHUNK_SIZE_Y) {
                                this.setBlock(chunk, i, y, j, BLOCK.OAK_PLANK.id, null);
                            }
                        }*/
                        continue;
                    }
                    //
                    if(point.height > 0) {
                        const is_array = Array.isArray(point.block_id);
                        for(let k = 0; k < point.height; k++) {
                            let y = cell.value2 + k - CHUNK_Y_BOTTOM - 1 + point.y_shift;
                            if(y >= 0 && y < CHUNK_SIZE_Y) {
                                this.setBlock(chunk, i, y, j, is_array ? point.block_id[k] : point.block_id, null);
                            }
                        }
                    } else {
                        const is_array = Array.isArray(point.block_id);
                        let ai = 0;
                        for(let k = point.height; k <= 0; k++) {
                            let y = cell.value2 + k - CHUNK_Y_BOTTOM - 1;
                            if(y >= 0 && y < CHUNK_SIZE_Y) {
                                // this.setBlock(chunk, i, y, j, k == point.height ? point.block_id : BLOCK.AIR.id, null);
                                let block_id = k == point.height ? point.block_id : BLOCK$1.AIR.id;
                                if(is_array) {
                                    block_id = point.block_id[ai++];
                                }
                                this.setBlock(chunk, i, y, j, block_id, null);
                            }
                        }
                    }
                }
            }
        }
    }

    // Return true if cell is occupied by any object (road or building)
    cellIsOccupied(x, y, z, margin) {
        if(this.is_empty) {
            return false;
        }
        x -= this.coord.x;
        y -= this.coord.y;
        z -= this.coord.z;
        const index = z * CLUSTER_SIZE.x + x;
        return this.near_mask[index] <= margin;
    }

    // Add NPC
    addNPC(chunk, pos) {
        // Auto generate mobs
        const auto_generate_mobs = this.clusterManager.chunkManager.world.getGeneratorOptions('auto_generate_mobs', true);
        if(!auto_generate_mobs) {
            return;
        }
        let rel_pos = pos.sub(chunk.coord);
        if(rel_pos.x < 0 || rel_pos.y < 0 || rel_pos.z < 0 || rel_pos.x >= CHUNK_SIZE_X || rel_pos.y >= CHUNK_SIZE_Y || rel_pos.z >= CHUNK_SIZE_Z) {
            return false;
        }
        const npc_extra_data = BLOCK$1.calculateExtraData(this.generateNPCSpawnExtraData(), rel_pos);
        this.setBlock(chunk, rel_pos.x, rel_pos.y, rel_pos.z, BLOCK$1.MOB_SPAWN.id, null, npc_extra_data);
        chunk.addTickingBlock(pos);
        return true;
    }

    // Add fence
    addFence(coord, size) {
        const dx = coord.x - this.coord.x;
        const dz = coord.z - this.coord.z;
        let fence_point = new ClusterPoint(2, [BLOCK$1.COBBLESTONE_WALL.id, BLOCK$1.OAK_FENCE.id], 1, null, null, 1);
        let fence_point_torch = new ClusterPoint(3, [BLOCK$1.COBBLESTONE_WALL.id, BLOCK$1.OAK_FENCE.id, BLOCK$1.TORCH.id], 1, null, null, 1);
        for(let i = 0; i < size.x; i++) {
            for(let j = 0; j < size.z; j++) {
                if(i == 0 || j == 0 || i == size.x - 1 || j == size.z - 1) {
                    const x = dx + i;
                    const z = dz + j;
                    if((i+j+coord.x+coord.z) % 20 == 0) {
                        this.mask[z * CLUSTER_SIZE.x + x] = fence_point_torch;
                    } else {
                        this.mask[z * CLUSTER_SIZE.x + x] = fence_point;
                    }
                }
            }
        }
    }

    // Add road platform
    addRoadPlatform(coord, size, road_block_palette) {
        const dx = coord.x - this.coord.x;
        const dz = coord.z - this.coord.z;
        for(let i = 0; i < size.x + 2; i++) {
            for(let j = 0; j < size.z + 2; j++) {
                const x = dx + i - 1;
                const z = dz + j - 1;
                // Draw road around plot
                this.mask[z * CLUSTER_SIZE.x + x] = new ClusterPoint(1, road_block_palette.next().id, 1, null, null);
            }
        }
    }

    //
    drawQuboid(chunk, pos, size, block, rotate, extra_data) {
        const bx = pos.x - chunk.coord.x;
        const by = pos.y - chunk.coord.y;
        const bz = pos.z - chunk.coord.z;
        for(let i = 0; i < size.x; i++) {
            for(let j = 0; j < size.z; j++) {
                for(let k = 0; k < size.y; k++) {
                    const x = bx + i;
                    const y = by + k;
                    const z = bz + j;
                    this.setBlock(chunk, x, y, z, block.id, rotate, extra_data);
                }
            }
        }
    }

    // Draw walls
    draw4Walls(chunk, pos, size, block_palette) {
        const bx = pos.x - chunk.coord.x;
        const by = pos.y - chunk.coord.y;
        const bz = pos.z - chunk.coord.z;
        const xyz = new Vector$1(0, 0, 0);
        block_palette.reset();
        for(let i = 0; i < size.x; i++) {
            for(let j = 0; j < size.z; j++) {
                for(let k = 0; k < size.y - 1; k++) {
                    const x = bx + i;
                    const y = by + k;
                    const z = bz + j;
                    xyz.copyFrom(pos).add(i, k, j);
                    const block_id = block_palette.next().id;
                    if(i < 1 || j < 1 || k < 0 || i > size.x - 2 || j > size.z - 2 || k > size.y - 1) {
                        this.setBlock(chunk, x, y, z, block_id, null);
                    } else {
                        this.setBlock(chunk, x, y, z, 0, null);
                    }
                }
            }
        }
    }

    // Add pitched roof
    drawPitchedRoof(chunk, pos, size, dir, block) {
        switch(dir) {
            // Look to north
            case DIRECTION.NORTH: {
                for(let i = 0; i < size.x; i++) {
                    for(let k = 0; k < size.y; k++) {
                        const x = pos.x - chunk.coord.x + i;
                        const y = pos.y - chunk.coord.y + k;
                        const z = pos.z - chunk.coord.z - k;
                        this.setBlock(chunk, x, y, z, block.id, {x: 0, y: 0, z: 0});
                    }
                }
                break;
            }
            // Look to south
            case DIRECTION.SOUTH: {
                for(let i = 0; i < size.x; i++) {
                    for(let k = 0; k < size.y; k++) {
                        const x = pos.x - chunk.coord.x + i;
                        const y = pos.y - chunk.coord.y + k;
                        const z = pos.z - chunk.coord.z + k;
                        this.setBlock(chunk, x, y, z, block.id, {x: 2, y: 0, z: 0});
                    }
                }
                break;
            }
            // Look to west
            case DIRECTION.WEST: {
                for(let j = 0; j < size.z; j++) {
                    for(let k = 0; k < size.y; k++) {
                        const x = pos.x - chunk.coord.x + k;
                        const y = pos.y - chunk.coord.y + k;
                        const z = pos.z - chunk.coord.z + j;
                        this.setBlock(chunk, x, y, z, block.id, {x: 1, y: 0, z: 0});
                    }
                }
                break;
            }
            // Look to east
            case DIRECTION.EAST: {
                for(let j = 0; j < size.z; j++) {
                    for(let k = 0; k < size.y; k++) {
                        const x = pos.x - chunk.coord.x - k;
                        const y = pos.y - chunk.coord.y + k;
                        const z = pos.z - chunk.coord.z + j;
                        this.setBlock(chunk, x, y, z, block.id, {x: 3, y: 0, z: 0});
                    }
                }
                break;
            }
        }
    }

    // Draw door
    drawDoor(chunk, pos, block, dir, opened, left) {
        const door_blocks = [block.id, block.next_part.id];
        for(let k of [0, 1]) {
            const x = pos.x - chunk.coord.x;
            const y = pos.y - chunk.coord.y + k;
            const z = pos.z - chunk.coord.z;
            if(x >= 0 && y >= 0 && z >= 0 && x < CHUNK_SIZE_X && y < CHUNK_SIZE_Y && z < CHUNK_SIZE_Z) {
                let rot = {x: dir, y: 0, z: 0};
                this.setBlock(chunk, x, y, z, door_blocks[k], rot, {point: {x: 0, y: 0, z: 0}, opened: opened, left: left});
                // this.setBlock(chunk, x, y, z - 1, BLOCK.AIR.id, null, null);
            }
        }
    }

    // Return extra data for block MOB_SPAWN
    generateNPCSpawnExtraData() {
        return {
            "type": "npc",
            "limit": {"count": 1},
            "calculated": [
                {"type": "random_item", "name": "skin", "items": [1, 2, 3, 4, 5, 6, 7, 10]},
                {"type": "random_int", "name": "max_ticks", "min_max": [1, 1]}
            ]
        }
    }

}

let randoms$9 = new Array(1024);
let a$9 = new impl('random_road_damage');
for(let i = 0; i < randoms$9.length; i++) {
    randoms$9[i] = a$9.double();
}

// Dev sandbox
globalThis.DIR_HOR = 0;
globalThis.DIR_VER = 1;

class VilageSchema {
    
    constructor(cluster, settings = {}) {
        this.cluster = cluster;
        this.fill_house_map = false;
        this.fill_house_door_path = false;
        if(!settings) {
            settings = {};
        }
        this.settings = {
            size:               128,
            road_dist:          2,
            margin:             8,
            quant:              12,
            init_depth:         2,
            road_margin:        1,
            house_margin:       5,
            road_ext_value:     2, // Это значение расширения дороги, 0 = один пиксель
            house_intencity:    0.2,
            road_damage_factor: 0,
            ...settings
        };
    }

    generate(seed) {
        this.randoms            = new impl(seed);
        this.crossroads         = new VectorCollector();
        this.mask               = new Array(this.settings.size * this.settings.size);
        this.cell_map           = [];
        this.cb_cell_map        = [];
        this.complex_buildings  = new Map();
        this.house_list         = new Map();
        const center_x_corr = Math.floor(this.randoms.double() * 20 - 10);
        const center_z_corr = Math.floor(this.randoms.double() * 20 - 10);
        this.push_branch((this.settings.size / 2) + center_x_corr, (this.settings.size / 2) + center_z_corr, DIR_HOR, this.settings.init_depth);
        this.push_branch((this.settings.size / 2) + center_x_corr, (this.settings.size / 2) + center_z_corr, DIR_VER, this.settings.init_depth);
        for(let cb_building of this.complex_buildings.values()) {
            // if it does not intersect with existing complex_building, then we send it to the map
            let house = this.put_building_complex(cb_building.x, cb_building.z, cb_building.cell_count_x, cb_building.cell_count_z, cb_building.path_dir);
            if(house !== null) {
                this.house_list.set(cb_building.z * this.settings.size + cb_building.x, house);
            }
        }
        //
        const light_point = new ClusterPoint(1, 69, 3, null);
        for(let [vec, cr] of this.crossroads.entries()) {
            if(cr.cnt > 1) {
                if(this.fill_house_map) {
                    this.mask[vec.z * this.settings.size + vec.x] = light_point;
                }
                let house = {
                    x:          vec.x,
                    z:          vec.z,
                    width:      1,
                    depth:      1,
                    crossroad:  true,
                    door:       {x: vec.x, z: vec.z, direction: DIRECTION.NORTH}
                };
                this.house_list.set(vec.z * this.settings.size + vec.x, house);
            }
        }
        //
        return {
            mask: this.mask,
            houses: this.house_list
        }
    }

    // Add crossroad point
    addCrossRoad(x, z) {
        let vec = new Vector$1(x, 0, z);
        let cr = this.crossroads.get(vec);
        if(cr) {
            cr.cnt++;
            return;
        }
        this.crossroads.set(vec, {cnt: 1});
    } 

    //
    isDamagedRoad() {
        if(!this.settings.road_damage_factor) {
            return false;
        }
        if(!this.damage_road_index) {
            this.damage_road_index = 0;
        }
        const r = randoms$9[this.damage_road_index++ % randoms$9.length];
        return r <= this.settings.road_damage_factor;
    }

    push_branch(x, z, axis, depth) {
        // One random per branch
        let branch_rnd = this.randoms.double();
        const settings = this.settings;
        let ln = (depth + 1) * settings.quant + 25;
        const is_x_mod = axis === DIR_HOR ? 1 : 0;
        const is_z_mod = axis === DIR_VER ? 1 : 0;
        var rnd = branch_rnd;
        rnd = rnd > .25 ? rnd : .25;
        rnd = rnd > .75 ? .75 : rnd;
        const pre_part = Math.floor(rnd * ln / settings.quant) * settings.quant;
        const post_part = Math.floor((ln - pre_part) / settings.quant) * settings.quant;
        // const road_point = new ClusterPoint(1, this.cluster.road_block, 5, null);
        this.addCrossRoad(x - (pre_part) * is_x_mod + 1, z - (pre_part) * is_z_mod + 1);
        this.addCrossRoad(x - (pre_part - post_part) * is_x_mod + 1, z - (pre_part - post_part) * is_z_mod + 1);
        for(var process = 0; process <= (pre_part + post_part) + settings.road_ext_value; process++) {
            let xprint = x - (pre_part - process) * is_x_mod;
            let zprint = z - (pre_part - process) * is_z_mod;
            if(xprint >= settings.margin
                && xprint < (settings.size - settings.margin)
                && zprint >= settings.margin
                && zprint < (settings.size - settings.margin)
            ) {
                // fill road blocks
                for(let road_step = 0; road_step <= settings.road_ext_value; road_step++) {
                    if(this.isDamagedRoad()) {
                        continue;
                    }
                    const dx = (xprint + (road_step * is_z_mod));
                    const dz = (zprint + (road_step * is_x_mod));
                    // this.mask[dz * settings.size + dx] = road_point;
                    this.mask[dz * settings.size + dx] = new ClusterPoint(1, this.cluster.road_block.next().id, 5, null);
                }
            }
        }
        // Installation of houses along the line
        // Number of cells for buildings in pre_part and post_part
        const positions = [Math.floor(pre_part / settings.quant), Math.floor(post_part / settings.quant)];
        for(let dir in positions) {
            let sign = dir === '1' ? 1 : -1;
            for(let i = 0; i < positions[dir]; i++) {
                // Right or Left
                let side_mod = (branch_rnd * (i + 7)) % 1 > .5 ? 1 : -1; // left
                // House on the right side of the line
                let q_mod = sign === -1 ? settings.quant : 0;
                let house_cell_x = x + (sign * settings.quant * i - q_mod) * is_x_mod;
                let house_cell_z = z + (sign * settings.quant * i - q_mod) * is_z_mod;
                if(side_mod < 0) {
                    if(axis === DIR_HOR) {
                        house_cell_z -= settings.quant;
                    } else {
                        house_cell_x -= settings.quant;
                    }
                }
                let building_rnd = this.randoms.double(); // (branch_rnd * house_cell_z * house_cell_x) % 1;
                if(building_rnd < settings.house_intencity || building_rnd > (1-settings.house_intencity)) {
                    let house = this.put_building(house_cell_x, house_cell_z);
                    if (house !== null) {
                        // Калькуляция точки начала и направления. Тропа всегда идет от дороги к двери
                        let dot_pos_x = house_cell_x, dot_pos_z = house_cell_z;
                        if (axis === DIR_HOR) {
                            dot_pos_x += Math.round(settings.quant / 2 + settings.road_ext_value / 2);
                            dot_pos_z += side_mod > 0 ? settings.road_ext_value : settings.quant;
                        } else {
                            dot_pos_x += side_mod > 0 ? settings.road_ext_value : settings.quant;
                            dot_pos_z += Math.round(settings.quant / 2 + settings.road_ext_value / 2);
                        }
                        // Add house to the registry by coordinate
                        house.door = this.putPathToDoor(dot_pos_x, dot_pos_z, axis === DIR_VER ? side_mod : 0, axis === DIR_HOR ? side_mod : 0);
                        this.house_list.set(house_cell_z * settings.size + house_cell_x, house);
                    }
                }
            }
            // Иногда делаем сложный дом затирая 2-4 ячейки, тут нам известно с какой стороны рисовать тропу к дому
            // Сложные дома справа, поэтому тропинки либо слева направо, либо сверху вниз,
            // Для разнообразия карту можно вращать
            const cb_random_param = (1 - settings.house_intencity);
            if(branch_rnd > cb_random_param && positions[dir] > 1) {
                this.complex_buildings.set(z * settings.size + x, {
                    x: x,
                    z: z,
                    cell_count_x: is_x_mod ? 2 : branch_rnd > cb_random_param ? 2 : 1,
                    cell_count_z: is_z_mod ? 2 : branch_rnd < (1 - cb_random_param) ? 2 : 1,
                    path_dir: axis === DIR_HOR ? 'up' : 'left'
                });
            }
        }
        // Installation of houses along the road line
        const next_dir = axis === DIR_VER ? DIR_HOR : DIR_VER;
        if(depth > 0) {
            let inc_amount = 0;
            if(post_part >= settings.quant) {
                inc_amount = settings.quant * Math.floor(post_part / settings.quant);
                let new_branch_rnd = this.randoms.double(); // ((x + (inc_amount * is_x_mod)) * (z + (settings.quant * is_z_mod)) / 1000) % 1;
                this.push_branch(x + (inc_amount * is_x_mod), z + (settings.quant * is_z_mod), next_dir, depth - 1, new_branch_rnd);
            }
            if(pre_part >= settings.quant) {
                inc_amount = settings.quant * Math.floor(pre_part / settings.quant);
                this.push_branch(x - (inc_amount * is_x_mod), z - (settings.quant * is_z_mod), next_dir, depth - 1, branch_rnd);
            }
        }
    }

    // Make road to door and return door object
    putPathToDoor(x, z, x_dir, z_dir) {
        let xprint = x, zprint = z, dest = this.settings.road_dist;
        for(var process = 0; process < dest; process++) {
            if(this.fill_house_door_path) {
                this.put_dot(xprint, zprint, process == dest - 1 ? this.cluster.basement_block : this.cluster.road_block.next().id, 1, this.settings.road_margin);
            }
            xprint += x_dir;
            zprint += z_dir;
        }
        let door = {
            x:          x_dir === 0 ? x : x + dest * x_dir,
            z:          z_dir === 0 ? z : z + dest * z_dir,
            direction:  this.get_door_front_direction(x_dir, z_dir),
        };
        return door;
    }

    // Returns the coordinate of the door and its direction
    get_door_front_direction(x_dir, z_dir) {
        return x_dir === 0 ? (z_dir < 0 ? DIRECTION.NORTH : DIRECTION.SOUTH) : (x_dir < 0 ?  DIRECTION.EAST : DIRECTION.WEST);
    }

    put_building(x, z) {
        const settings = this.settings;
        let key = z * settings.size + x;
        if(this.cell_map[key] !== undefined) {
            return null;
        }
        this.cell_map[key] = 1;
        // Road margins
        x += settings.road_dist;
        z += settings.road_dist;
        let x_size = settings.quant - settings.road_dist * 2 - settings.road_ext_value;
        let z_size = x_size;
        // Проверка удаленности дома от границы кластера
        if(x >= settings.margin
            && (x + x_size) < (settings.size - settings.margin)
            && z >= settings.margin
            && (z + z_size) < (settings.size - settings.margin)
        ) {
            let house = {
                x:      x + settings.road_ext_value,
                z:      z + settings.road_ext_value,
                width:  x_size + 1,
                depth:  z_size + 1,
                door:   null
            };
            // Drawing house perimeter
            if(this.fill_house_map) {
                for(var i = 0; i < house.width; i++) {
                    for(var j = 0; j < house.depth; j++) {
                        this.mask[(house.z + j) * settings.size + (house.x + i)] = new ClusterPoint(1, this.cluster.basement_block, this.settings.house_margin, null);
                    }
                }
            }
            return house;
        } else {
            return null;
        }
    }

    put_dot(x, z, block_id, height, margin) {
        const settings = this.settings;
        if(x >= settings.margin
            && x < (settings.size - settings.margin)
            && z >= settings.margin
            && z < (settings.size - settings.margin)
        ) {
            this.mask[z * settings.size + x] = new ClusterPoint(height, block_id, margin ? margin: 5, null);
            return true;
        } else {
            return false;
        }
    }

    put_building_complex(x, z, cell_count_x, cell_count_z, path_dir) {
        // Настройки
        const settings = this.settings;
        // Начальные параметры
        const x_init = x;
        const z_init = z;
        // Проверяем на непересечение с другими complex_building, для обозначения cell берется стартовая координата ячейки
        let local_cb_cell_map = [];
        for (var cell_x = 0; cell_x < cell_count_x; cell_x++) {
            for (var cell_z = 0; cell_z < cell_count_z; cell_z++) {
                let tmp_x = x + (cell_x * settings.quant);
                let tmp_z = z + (cell_z * settings.quant);
                let key = tmp_z * settings.size + tmp_x;
                local_cb_cell_map[key] = 1;
            }
        }
        for(let lcm_key in local_cb_cell_map) {
            if(this.cb_cell_map[lcm_key] !== undefined) {
                return null;
            } else {
                this.cb_cell_map[lcm_key] = 1;
            }
        }
        // Отступы от дорог
        x += settings.road_dist + settings.road_ext_value;
        z += settings.road_dist + settings.road_ext_value;
        let x_size = settings.quant * cell_count_x - settings.road_dist * 2 + 1 - settings.road_ext_value;
        let z_size = settings.quant * cell_count_z - settings.road_dist * 2 + 1 - settings.road_ext_value;
        // Проверка удаленности дома от границы кластера
        if(x >= settings.margin
            && (x + x_size) < (settings.size - settings.margin)
            && (z) >= settings.margin
            && (z + z_size) < (settings.size - settings.margin)
        ) {
            // Зачистка территории под сложный дом
            for (let i = settings.road_ext_value + 1; i < cell_count_x * settings.quant; i++) {
                for (let j = settings.road_ext_value + 1; j < cell_count_z * settings.quant; j++) {
                    this.mask[(z_init + j) * settings.size + (x_init + i)] = null;
                }
            }
            // Отрисовка площадки под дом на карте
            if(this.fill_house_map) {
                for(let i = 0; i < x_size; i++) {
                    for(let j = 0; j < z_size; j++) {
                        this.mask[(z + j) * settings.size + (x + i)] = new ClusterPoint(1, this.cluster.basement_block, this.settings.house_margin);
                    }
                }
            }
            for(let x_cursor = 0; x_cursor <= settings.quant * cell_count_x + settings.road_ext_value; x_cursor++) {
                for(let road_step = 0; road_step < 1 + settings.road_ext_value; road_step++) {
                    if(this.isDamagedRoad()) {
                        continue;
                    }
                    this.put_dot((x_init + x_cursor), (z_init + settings.quant * cell_count_z + road_step), this.cluster.road_block.next().id, 1, this.settings.road_margin);
                }
            }
            // Отрисовка дороги вокруг сложного дома для обеспечения соединенности всех дорог
            for(let x_cursor = 0; x_cursor <= settings.quant * cell_count_x + settings.road_ext_value; x_cursor++) {
                for(let road_step = 0; road_step < 1 + settings.road_ext_value; road_step++) {
                    if(this.isDamagedRoad()) {
                        continue;
                    }
                    this.put_dot((x_init + x_cursor), (z_init + settings.quant * cell_count_z + road_step), this.cluster.road_block.next().id, 1, this.settings.road_margin);
                    this.put_dot((x_init + x_cursor), (z_init + road_step), this.cluster.road_block.next().id, 1, this.settings.road_margin);
                }
            }
            for (let z_cursor = 0; z_cursor <= settings.quant * cell_count_z + settings.road_ext_value; z_cursor++) {
                for (let road_step = 0; road_step < 1 + settings.road_ext_value; road_step++) {
                    if(this.isDamagedRoad()) {
                        continue;
                    }
                    this.put_dot((x_init + road_step), (z_init + z_cursor), this.cluster.road_block.next().id, 1, this.settings.road_margin);
                    this.put_dot((x_init + road_step + settings.quant * cell_count_x), (z_init + z_cursor), this.cluster.road_block.next().id, 1, this.settings.road_margin);
                }
            }
            // Отрисовка тропинки
            let path_x = x_init;
            let path_z = z_init;
            if(path_dir === 'up') {
                path_x = x_init + (cell_count_x * settings.quant) / 2;
                path_z += settings.road_ext_value;
            } else {
                path_x += settings.road_ext_value;
                path_z = z_init + (cell_count_z * settings.quant) / 2;
            }
            // Затираем обычные дома под сложным домом
            for(let i = x_init; i < x_init + (settings.quant * cell_count_x); i += settings.quant) {
                for(let j = z_init; j < z_init + (settings.quant * cell_count_z); j += settings.quant) {
                    if(this.house_list.has(j * settings.size + i)) {
                        this.house_list.delete(j * settings.size + i);
                    }
                }
            }
            // Возвращаем дом
            let house = {
                x:      x,
                z:      z,
                width:  x_size,
                depth:  z_size,
                door:   this.putPathToDoor(path_x, path_z, path_dir === 'up' ? 0 : 1, path_dir === 'up' ? 1 : 0),
            };
            return house;
        } else {
            return null;
        }
    }

}

const BUILDING_AABB_MARGIN  = 3; // because building must calling to draw from neighbours chunks

// Base building
class Building {

    constructor(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size) {
        this.randoms        = new impl(coord.toHash());
        this.cluster        = cluster;
        this.id             = coord.toHash();
        this.seed           = seed;
        this.coord          = coord;
        this.aabb           = aabb;
        this.entrance       = entrance;
        this.door_bottom    = door_bottom;
        this.door_direction = door_direction;
        this.size           = size;
        this.materials      = null;
        this.draw_entrance  = true;
    }

    // Translate position
    translate(vec) {
        this.aabb.translate(vec.x, vec.y, vec.z);
        this.coord.addSelf(vec);
        this.entrance.addSelf(vec);
        this.door_bottom.addSelf(vec);
    }

    //
    draw(cluster, chunk) {
        // 4 walls
        cluster.drawQuboid(chunk, this.coord, this.size, BLOCK$1.TEST);
    }

    drawBasement(cluster, chunk, height, basement_block_id) {
        const building = this;
        // quboid
        const coord = building.coord.clone().add(new Vector$1(0, -height, 0));
        const size = building.size.clone().add(new Vector$1(0, -building.size.y + 4, 0));
        cluster.drawQuboid(chunk, coord, size, BLOCK$1.fromId(basement_block_id || this.cluster.basement_block));
    }

    // Limit building size
    static limitSize(max_sizes, seed, coord, size, entrance, door_bottom, door_direction, shift_entrance_value = 0) {
        const orig_coord = coord.clone();
        const orig_size = size.clone();
        const dir = door_direction;
        shift_entrance_value = shift_entrance_value | 0;
        let sign = (dir == DIRECTION.NORTH || dir == DIRECTION.EAST)  ? -1 : 1;
        const max_size = {
            x: max_sizes[max_sizes.length * seed | 0],
            z: max_sizes[max_sizes.length * (seed * 10 % 1) | 0]
        };
        //
        if(size.x > max_size.x) {
            size.x = max_size.x;
        }
        if(door_direction == DIRECTION.NORTH) {
            coord.x = entrance.x - Math.ceil(size.x / 2);
        } else if(door_direction == DIRECTION.SOUTH) {
            coord.x = entrance.x - (Math.floor(size.x / 2) - 1) * sign;
        } else if(door_direction == DIRECTION.EAST) {
            coord.x = entrance.x - (size.x - 1);
        } else {
            coord.x = entrance.x;
        }
        //
        if(size.z > max_size.z) {
            size.z = max_size.z;
        }
        if(door_direction == DIRECTION.NORTH) {
            coord.z = entrance.z - (size.z - 1);
        } else if(door_direction == DIRECTION.SOUTH) {
            // do nothing
        } else if(door_direction == DIRECTION.EAST) {
            coord.z = entrance.z - Math.ceil(size.z / 2);
        } else {
            coord.z = entrance.z - (Math.floor(size.z / 2) - 1) * sign;
        }
        // Fix exit ouside first area 
        if(door_direction == DIRECTION.NORTH || door_direction == DIRECTION.SOUTH) {
            const shift_start = orig_coord.x - coord.x;
            const shift_end = (coord.x + size.x) - (orig_coord.x + orig_size.x);
            if(shift_start < 0) {
                coord.x += shift_start;
                entrance.x += shift_start + shift_entrance_value;
                door_bottom.x += shift_start + shift_entrance_value;
            } else if(shift_end < 0) {
                coord.x -= shift_end;
                entrance.x -= shift_end + shift_entrance_value;
                door_bottom.x -= shift_end + shift_entrance_value;
            }
        } else {
            const shift_start = orig_coord.z - coord.z;
            const shift_end = (coord.z + size.z) - (orig_coord.z + orig_size.z);
            if(shift_start < 0) {
                coord.z += shift_start;
                entrance.z += shift_start + shift_entrance_value;
                door_bottom.z += shift_start + shift_entrance_value;
            } else if(shift_end < 0) {
                coord.z -= shift_end;
                entrance.z -= shift_end + shift_entrance_value;
                door_bottom.z -= shift_end + shift_entrance_value;
            }
        }
    }

    addHays(dx, dz) {
        const rad = 2 + Math.round(this.randoms.double() * 1);
        for(let i = -rad; i < rad; i++) {
            for(let j = -rad; j < rad; j++) {
                const x = dx + i;
                const z = dz + j;
                let h = Math.round(this.randoms.double() * 2);
                if(h == 0) {
                    continue;
                }
                this.cluster.mask[z * CLUSTER_SIZE.x + x] = new ClusterPoint(h, BLOCK$1.HAY_BLOCK.id, 1, null, null, 1); 
            }
        }
    }

    // Draw blocks
    drawBlocks(cluster, chunk) {
        const vec = new Vector$1(0, 0, 0);
        const block_coord = this.door_bottom.clone().subSelf(chunk.coord);
        const dir = this.door_direction;
        for (let i = 0; i < this.blocks.list.length; i++) {
            const item = this.blocks.list[i];
            vec.copyFrom(block_coord).addByCardinalDirectionSelf(item.move, dir + 2, this.blocks.mirror_x, this.blocks.mirror_z);
            cluster.setBlock(chunk, vec.x, vec.y, vec.z, item.block_id, item.rotate, item.extra_data);
        }
    }
    
    //
    drawPitchedRoof(chunk, coord, size, dir, roof_block, roof_ridge_block, roof_gable_block) {
        const cluster = this.cluster;
        // gable | фронтон
        if(roof_gable_block) {
            roof_gable_block.reset();
            if(dir == DIRECTION.EAST || dir == DIRECTION.WEST) {
                let pos = new Vector$1(coord.x, coord.y + size.y - 2, coord.z).subSelf(chunk.coord);
                let w = size.z - 2;
                for(let i = 1; i < Math.floor(size.z / 2); i++) {
                    pos.y++;
                    pos.z++;
                    for(let j = 0; j < w; j++) {
                        cluster.setBlock(chunk, pos.x, pos.y, pos.z + j, roof_gable_block.next().id, null);
                        cluster.setBlock(chunk, pos.x + size.x - 1, pos.y, pos.z + j, roof_gable_block.next().id, null);
                    }
                    w -= 2;
                }
            } else {
                let pos = new Vector$1(coord.x, coord.y + size.y - 2, coord.z).subSelf(chunk.coord);
                let w = size.x - 2;
                for(let i = 1; i < Math.floor(size.x / 2); i++) {
                    pos.y++;
                    pos.x++;
                    for(let j = 0; j < w; j++) {
                        cluster.setBlock(chunk, pos.x + j, pos.y, pos.z, roof_gable_block.next().id, null);
                        cluster.setBlock(chunk, pos.x + j, pos.y, pos.z + size.z - 1, roof_gable_block.next().id, null);
                    }
                    w -= 2;
                }
            }
        }
        // roof ridge | конёк
        if(roof_ridge_block) {
            if(dir == DIRECTION.EAST || dir == DIRECTION.WEST) {
                if(size.z % 2 == 1) {
                    const roof_height = Math.floor(size.z / 2);
                    let q_pos = new Vector$1(coord.x - 1, coord.y + size.y + roof_height - 3, coord.z + roof_height);
                    cluster.drawQuboid(chunk, q_pos, new Vector$1(size.x + 2, 1, 1), roof_ridge_block);
                }
            } else if(dir == DIRECTION.NORTH || dir == DIRECTION.SOUTH) {
                if(size.x % 2 == 1) {
                    const roof_height = Math.floor(size.x / 2);
                    let q_pos = new Vector$1(coord.x + roof_height, coord.y + size.y + roof_height - 3, coord.z - 1);
                    cluster.drawQuboid(chunk, q_pos, new Vector$1(1, 1, size.z + 2), roof_ridge_block);
                }
            }
        }
        // pitched planes | скаты
        if(dir == DIRECTION.WEST || dir == DIRECTION.EAST) {
            let roof_height = Math.ceil(size.z / 2);
            if(size.z % 2 == 0) {
                roof_height++;
            }
            // south side
            let roof_pos = new Vector$1(coord.x - 1, coord.y + size.y - 3, coord.z - 1);
            let roof_size = new Vector$1(size.x + 2, roof_height, 0);
            cluster.drawPitchedRoof(chunk, roof_pos, roof_size, DIRECTION.SOUTH, roof_block);
            // north side
            roof_pos = new Vector$1(coord.x - 1, coord.y + size.y - 3, coord.z + size.z);
            roof_size = new Vector$1(size.x + 2, roof_height, 0);
            cluster.drawPitchedRoof(chunk, roof_pos, roof_size, DIRECTION.NORTH, roof_block);
        } else if(dir == DIRECTION.SOUTH || dir == DIRECTION.NORTH) {
            const roof_size_add = 2;
            const minus_y = 3;
            let roof_height = Math.ceil(size.x / 2);
            if(size.x % 2 == 0) {
                roof_height++;
            }
            // west side
            let roof_pos = new Vector$1(coord.x - 1, coord.y + size.y - minus_y, coord.z - 1);
            let roof_size = new Vector$1(0, roof_height, size.z + roof_size_add);
            cluster.drawPitchedRoof(chunk, roof_pos, roof_size, DIRECTION.WEST, roof_block);
            // east side
            roof_pos = new Vector$1(coord.x + size.x, coord.y + size.y - minus_y, coord.z - 1);
            roof_size = new Vector$1(0, roof_height, size.z + roof_size_add);
            cluster.drawPitchedRoof(chunk, roof_pos, roof_size, DIRECTION.EAST, roof_block);
        }
    }

}

// Farmland
class Farmland extends Building {

    constructor(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size) {
        size.y = 2;
        Building.limitSize([3, 5, 7, 7, 10, 10, 10, 13, 13, 13, 16, 16, 16], seed, coord, size, entrance, door_bottom, door_direction);
        //
        super(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size);
        //
        this.seeds = this.randoms.double() < .5 ? BLOCK$1.CARROT_SEEDS : BLOCK$1.WHEAT_SEEDS;
        this.draw_entrance = false;
    }

    draw(cluster, chunk) {
        // super.draw(cluster, chunk);
        this.drawBasement(cluster, chunk, 4, BLOCK$1.DIRT.id);
        const building = this;
        cluster.drawQuboid(chunk, building.coord.add(new Vector$1(0, -1, 0)), building.size.add(new Vector$1(0, 5, 0)), BLOCK$1.AIR);
        cluster.drawQuboid(chunk, building.coord.add(new Vector$1(0, -1, 0)), building.size, BLOCK$1.OAK_TRUNK);
        let inner_size = building.size.clone().addSelf(new Vector$1(-2, -1, -2));
        let pos = building.coord.clone().addSelf(new Vector$1(1, 0, 1));
        cluster.drawQuboid(chunk, pos, inner_size, BLOCK$1.FARMLAND_WET);
        //
        pos.addSelf(new Vector$1(0, 1, 0));
        cluster.drawQuboid(chunk, pos, inner_size, this.seeds, null, {stage: 7, complete: true});
        // water
        for(let axe of ['x', 'z']) {
            if(building.size[axe] >= 7) {
                const sz = building.size[axe];
                if((sz - 7) % 3 == 0) {
                    const water_pos = building.coord.clone();
                    const water_size = inner_size.clone();
                    if(axe == 'x') {
                        water_pos.z++;
                        water_size.x = 1;
                    } else {
                        water_pos.x++;
                        water_size.z = 1;
                    }
                    water_size.y = 1;
                    for(let i = 3; i < building.size[axe] - 1; i += 3) {
                        water_pos[axe] += 3;
                        cluster.drawQuboid(chunk, water_pos, water_size, BLOCK$1.STILL_WATER);
                        water_pos.y++;
                        cluster.drawQuboid(chunk, water_pos, water_size, BLOCK$1.AIR);
                        water_pos.y--;
                    }
                    break;
                }
            }
        }
    }

}

// Street light
class StreetLight extends Building {

    constructor(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size) {
        super(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size);
        this.draw_entrance = false;
        // Blocks
        const mirror_x           = door_direction % 2 == 1;
        this.blocks = {
            mirror_x:       mirror_x,
            mirror_z:       false,
            list:           []
        };
        if(seed > .75) {
            this.blocks.list.push(...[
                {move: new Vector$1(0, -1, 0), block_id: BLOCK$1.COBBLESTONE.id},
                {move: new Vector$1(0, 0, 0), block_id: BLOCK$1.COBBLESTONE_WALL.id},
                {move: new Vector$1(0, 1, 0), block_id: BLOCK$1.OAK_FENCE.id},
                {move: new Vector$1(0, 2, 0), block_id: BLOCK$1.OAK_FENCE.id},
                {move: new Vector$1(0, 3, 0), block_id: BLOCK$1.COBBLESTONE_WALL.id},
                {move: new Vector$1(0, 4, 0), block_id: BLOCK$1.COBBLESTONE.id},
                {move: new Vector$1(0, 4, -1), block_id: BLOCK$1.OAK_SLAB.id, rotate: new Vector$1(DIRECTION.NORTH, 0, 0)},
                {move: new Vector$1(0, 4, 1), block_id: BLOCK$1.OAK_SLAB.id, rotate: new Vector$1(DIRECTION.SOUTH, 0, 0)},
                {move: new Vector$1(-1, 4, 0), block_id: BLOCK$1.OAK_SLAB.id, rotate: new Vector$1(DIRECTION.EAST, 0, 0)},
                {move: new Vector$1(1, 4, 0), block_id: BLOCK$1.OAK_SLAB.id, rotate: new Vector$1(DIRECTION.WEST, 0, 0)},
                {move: new Vector$1(0, 3, -1), block_id: BLOCK$1.LANTERN.id, rotate: new Vector$1(DIRECTION.NORTH, -1, 0)},
                {move: new Vector$1(0, 3, 1), block_id: BLOCK$1.LANTERN.id, rotate: new Vector$1(DIRECTION.SOUTH, -1, 0)},
                {move: new Vector$1(-1, 3, 0), block_id: BLOCK$1.LANTERN.id, rotate: new Vector$1(DIRECTION.EAST, -1, 0)},
                {move: new Vector$1(1, 3, 0), block_id: BLOCK$1.LANTERN.id, rotate: new Vector$1(DIRECTION.WEST, -1, 0)},
            ]);
        } else {
            this.blocks.list.push(...[
                {move: new Vector$1(0, -1, 0), block_id: BLOCK$1.COBBLESTONE.id},
                {move: new Vector$1(0, 0, 0), block_id: BLOCK$1.OAK_FENCE.id},
                {move: new Vector$1(0, 1, 0), block_id: BLOCK$1.OAK_FENCE.id},
                {move: new Vector$1(0, 2, 0), block_id: BLOCK$1.OAK_FENCE.id},
                {move: new Vector$1(0, 3, 0), block_id: BLOCK$1.GRAY_WOOL.id},
                {move: new Vector$1(0, 3, -1), block_id: BLOCK$1.TORCH.id, rotate: new Vector$1(DIRECTION.NORTH, 0, 0)},
                {move: new Vector$1(0, 3, 1), block_id: BLOCK$1.TORCH.id, rotate: new Vector$1(DIRECTION.SOUTH, 0, 0)},
                {move: new Vector$1(-1, 3, 0), block_id: BLOCK$1.TORCH.id, rotate: new Vector$1(DIRECTION.EAST, 0, 0)},
                {move: new Vector$1(1, 3, 0), block_id: BLOCK$1.TORCH.id, rotate: new Vector$1(DIRECTION.WEST, 0, 0)},
            ]);
        }
    }

    //
    draw(cluster, chunk) {
        // draw blocks
        this.drawBlocks(cluster, chunk);
    }

}

// Water well
class WaterWell extends Building {

    constructor(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size) {
        coord.y = -14;
        size.y = 21;
        Building.limitSize([3], seed, coord, size, entrance, door_bottom, door_direction);
        super(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size);
        //
        cluster.road_block.reset();
        cluster.addRoadPlatform(coord, size, cluster.road_block);
        //
        this.draw_entrance = false;
        // Blocks
        const dir = door_direction;
        const mirror_x = door_direction % 2 == 1;
        this.blocks = {
            mirror_x:       mirror_x,
            mirror_z:       false,
            list:           []
        };
        if(seed < .75) {
            this.wallBlocks = this.cluster.createPalette([
                {value: BLOCK$1.OAK_PLANK, chance: 1}
            ]);
            this.blocks.list.push(...[
                {move: new Vector$1(0, 1, 1), block_id: BLOCK$1.COBBLESTONE_WALL.id},
                {move: new Vector$1(2, 1, 1), block_id: BLOCK$1.COBBLESTONE_WALL.id},
                {move: new Vector$1(0, 2, 1), block_id: BLOCK$1.OAK_FENCE.id},
                {move: new Vector$1(2, 2, 1), block_id: BLOCK$1.OAK_FENCE.id},
                //
                {move: new Vector$1(0, 3, 0), block_id: BLOCK$1.OAK_STAIRS.id, rotate: new Vector$1((dir + 0) % 4, 0, 0)},
                {move: new Vector$1(1, 3, 0), block_id: BLOCK$1.OAK_STAIRS.id, rotate: new Vector$1((dir + 0) % 4, 0, 0)},
                {move: new Vector$1(2, 3, 0), block_id: BLOCK$1.OAK_STAIRS.id, rotate: new Vector$1((dir + 1 + (mirror_x?2:0)) % 4, 0, 0)},
                {move: new Vector$1(2, 3, 1), block_id: BLOCK$1.OAK_STAIRS.id, rotate: new Vector$1((dir + 1 + (mirror_x?2:0)) % 4, 0, 0)},
                {move: new Vector$1(2, 3, 2), block_id: BLOCK$1.OAK_STAIRS.id, rotate: new Vector$1((dir + 2) % 4, 0, 0)},
                {move: new Vector$1(1, 3, 2), block_id: BLOCK$1.OAK_STAIRS.id, rotate: new Vector$1((dir + 2) % 4, 0, 0)},
                {move: new Vector$1(0, 3, 2), block_id: BLOCK$1.OAK_STAIRS.id, rotate: new Vector$1((dir + 3 + (mirror_x?2:0)) % 4, 0, 0)},
                {move: new Vector$1(0, 3, 1), block_id: BLOCK$1.OAK_STAIRS.id, rotate: new Vector$1((dir + 3 + (mirror_x?2:0)) % 4, 0, 0)},
                //
                {move: new Vector$1(1, 4, 1), block_id: BLOCK$1.OAK_SLAB.id},
            ]);
        } else {
            this.wallBlocks = this.cluster.createPalette([
                {value: BLOCK$1.COBBLESTONE, chance: 1}
            ]);
            this.blocks.list.push(...[
                {move: new Vector$1(0, 1, 0), block_id: BLOCK$1.OAK_FENCE.id},
                {move: new Vector$1(0, 2, 0), block_id: BLOCK$1.OAK_FENCE.id},
                {move: new Vector$1(2, 1, 0), block_id: BLOCK$1.OAK_FENCE.id},
                {move: new Vector$1(2, 2, 0), block_id: BLOCK$1.OAK_FENCE.id},
                {move: new Vector$1(0, 1, 2), block_id: BLOCK$1.OAK_FENCE.id},
                {move: new Vector$1(0, 2, 2), block_id: BLOCK$1.OAK_FENCE.id},
                {move: new Vector$1(2, 1, 2), block_id: BLOCK$1.OAK_FENCE.id},
                {move: new Vector$1(2, 2, 2), block_id: BLOCK$1.OAK_FENCE.id},
                //
                {move: new Vector$1(0, 3, 0), block_id: BLOCK$1.COBBLESTONE_SLAB.id},
                {move: new Vector$1(1, 3, 0), block_id: BLOCK$1.COBBLESTONE_SLAB.id},
                {move: new Vector$1(2, 3, 0), block_id: BLOCK$1.COBBLESTONE_SLAB.id},
                {move: new Vector$1(2, 3, 1), block_id: BLOCK$1.COBBLESTONE_SLAB.id},
                {move: new Vector$1(2, 3, 2), block_id: BLOCK$1.COBBLESTONE_SLAB.id},
                {move: new Vector$1(1, 3, 2), block_id: BLOCK$1.COBBLESTONE_SLAB.id},
                {move: new Vector$1(0, 3, 2), block_id: BLOCK$1.COBBLESTONE_SLAB.id},
                {move: new Vector$1(0, 3, 1), block_id: BLOCK$1.COBBLESTONE_SLAB.id},
                //
                {move: new Vector$1(1, 3, 1), block_id: BLOCK$1.COBBLESTONE.id},
                //
                {move: new Vector$1(1, 0, 0), block_id: BLOCK$1.COBBLESTONE_STAIRS.id, rotate: new Vector$1((dir + 0) % 4, 0, 0)},
                {move: new Vector$1(2, 0, 1), block_id: BLOCK$1.COBBLESTONE_STAIRS.id, rotate: new Vector$1((dir + 1 + (mirror_x?2:0)) % 4, 0, 0)},
                {move: new Vector$1(1, 0, 2), block_id: BLOCK$1.COBBLESTONE_STAIRS.id, rotate: new Vector$1((dir + 2) % 4, 0, 0)},
                {move: new Vector$1(0, 0, 1), block_id: BLOCK$1.COBBLESTONE_STAIRS.id, rotate: new Vector$1((dir + 3 + (mirror_x?2:0)) % 4, 0, 0)},
            ]);
        }
    }

    //
    draw(cluster, chunk) {
        const building = this;
        // 4 walls
        const walls_size = building.size.clone().add(new Vector$1(0, -4, 0));
        cluster.draw4Walls(chunk, building.coord, walls_size, this.wallBlocks);
        const q_pos = building.coord.add(new Vector$1(1, 1, 1));
        const q_size = walls_size.add(new Vector$1(-2, -2, -2));
        cluster.drawQuboid(chunk, q_pos, q_size, BLOCK$1.STILL_WATER);
        this.drawBlocks(cluster, chunk);
    }

}

// Building1
class Building1 extends Building {

    static MAX_SIZES = [7];

    constructor(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size) {
        const orig_coord = coord.clone();
        const orig_size = size.clone();
        Building.limitSize(Building1.MAX_SIZES, seed, coord, size, entrance, door_bottom, door_direction);
        //
        aabb = new AABB().set(0, 0, 0, size.x, size.y, size.z).translate(coord.x, coord.y, coord.z).pad(BUILDING_AABB_MARGIN);
        super(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size);
        this.is_big_building = orig_size.x > 11 && orig_size.z > 11;
        //
        if(cluster.flat) {
            if(seed < .5) {
                this.materials  = {
                    wall: BLOCK$1.STONE_BRICK,
                    door: BLOCK$1.SPRUCE_DOOR,
                    roof: BLOCK$1.DARK_OAK_STAIRS,
                    roof_block: BLOCK$1.DARK_OAK_PLANK,
                    light: BLOCK$1.LANTERN
                };
            } else {
                this.materials  = {
                    wall: BLOCK$1.BRICKS,
                    door: BLOCK$1.DARK_OAK_DOOR,
                    roof: BLOCK$1.DARK_OAK_STAIRS,
                    roof_block: BLOCK$1.DARK_OAK_PLANK,
                    light: BLOCK$1.LANTERN
                };
            }
        } else {
            if(seed < .5) {
                this.materials  = {
                    wall: BLOCK$1.OAK_PLANK,
                    door: BLOCK$1.OAK_DOOR,
                    roof: BLOCK$1.DARK_OAK_STAIRS,
                    roof_block: BLOCK$1.DARK_OAK_PLANK,
                    light: BLOCK$1.TORCH
                };
            } else {
                this.materials  = {
                    wall: BLOCK$1.OAK_PLANK,
                    door: BLOCK$1.OAK_DOOR,
                    roof: BLOCK$1.DARK_OAK_STAIRS,
                    roof_block: BLOCK$1.DARK_OAK_PLANK,
                    light: BLOCK$1.TORCH
                };
            }
        }
        //
        this.wallBlocks = this.cluster.createPalette([
            {value: this.materials.wall, chance: 1}
        ]);
        // Blocks
        const dir                = this.door_direction;
        const mirror_x           = dir % 2 == 1;
        const add_hays           = this.randoms.double() <= .75;
        const has_crafting_table = this.randoms.double() <= .4;
        const has_chandelier     = this.randoms.double() <= .8;
        const has_chest          = this.randoms.double() <= .5;
        const has_bed            = this.randoms.double() <= .6;
        const has_bookcases      = this.randoms.double();
        this.blocks = {
            mirror_x:       mirror_x,
            mirror_z:       false,
            list:           [
                {move: new Vector$1(-1, 2, 5), block_id: BLOCK$1.SPRUCE_PLANK.id},
                {move: new Vector$1(-1, 2, 4), block_id: BLOCK$1.SPRUCE_PLANK.id},
                {move: new Vector$1(0, 2, 5), block_id: BLOCK$1.SPRUCE_PLANK.id},
                {move: new Vector$1(0, 2, 4), block_id: BLOCK$1.SPRUCE_PLANK.id},
                {move: new Vector$1(1, 2, 5), block_id: BLOCK$1.SPRUCE_PLANK.id},
                {move: new Vector$1(1, 2, 4), block_id: BLOCK$1.SPRUCE_PLANK.id},
                {move: new Vector$1(2, 2, 5), block_id: BLOCK$1.SPRUCE_SLAB.id},
                {move: new Vector$1(2, 2, 4), block_id: BLOCK$1.SPRUCE_SLAB.id},
                {move: new Vector$1(3, 2, 5), block_id: BLOCK$1.SPRUCE_SLAB.id},
                {move: new Vector$1(3, 2, 4), block_id: BLOCK$1.SPRUCE_SLAB.id},
                {move: new Vector$1(2, 1, 3), block_id: BLOCK$1.SPRUCE_STAIRS.id, rotate: new Vector$1(dir, 0, 0)},
                {move: new Vector$1(2, 0, 2), block_id: BLOCK$1.SPRUCE_STAIRS.id, rotate: new Vector$1(dir, 0, 0)},
                {move: new Vector$1(-1, 3, 4), block_id: BLOCK$1.OAK_FENCE.id},
                {move: new Vector$1(0, 3, 4), block_id: BLOCK$1.OAK_FENCE.id},
                {move: new Vector$1(1, 3, 4), block_id: BLOCK$1.OAK_FENCE.id},
            ]
        };
        //
        if(this.is_big_building) {
            // draw fence
            cluster.addFence(orig_coord, orig_size, door_bottom, this.blocks.list);
            //
            if(add_hays) {
                const centerOfHay = door_bottom.clone().addByCardinalDirectionSelf(new Vector$1(-11, 0, 6), door_direction + 2);
                const dx = centerOfHay.x - cluster.coord.x;
                const dz = centerOfHay.z - cluster.coord.z;
                this.addHays(dx, dz);
            }
        }
        if(has_chest) {
            this.blocks.list.push({
                move: new Vector$1(-1, 3, 5),
                block_id: BLOCK$1.CHEST.id,
                rotate: {x: (dir + 1 + (mirror_x ? 2 : 0)) % 4, y: 1, z: 0},
                extra_data: {generate: true, params: {source: 'village_house'}}
            });
        }
        // Bed
        if(has_bed) {
            const color_index = ((this.randoms.double() * 4) | 0);
            const bed_block_id = 1210 + color_index;
            const carpet_block_id = 810 + color_index;
            this.blocks.list.push({move: new Vector$1(1, 0, 5), block_id: bed_block_id, rotate: {x: (dir + 1 + (mirror_x ? 0 : 2)) % 4, y: -1, z: 0}});
            this.blocks.list.push({move: new Vector$1(2, 0, 5), block_id: bed_block_id, rotate: {x: (dir + 3 + (mirror_x ? 0 : 2)) % 4, y: -1, z: 0}, extra_data: {is_head: true}});
            this.blocks.list.push({move: new Vector$1(1, 0, 4), block_id: carpet_block_id, rotate: {x: 0, y: 1, z: 0}});
        }
        // Book cases
        if(has_bookcases < .6) {
            let bc_start_pos = null;
            if(has_bookcases < .2) {
                bc_start_pos = new Vector$1(3, 0, 4);
            } else if(has_bookcases < .4) {
                bc_start_pos = new Vector$1(-1, 0, 1);
            }
            if(bc_start_pos) {
                this.blocks.list.push({move: bc_start_pos.add(new Vector$1(0, 0, 0)), block_id: BLOCK$1.BOOKCASE.id});
                this.blocks.list.push({move: bc_start_pos.add(new Vector$1(0, 0, 1)), block_id: BLOCK$1.BOOKCASE.id});
                this.blocks.list.push({move: bc_start_pos.add(new Vector$1(0, 1, 0)), block_id: BLOCK$1.BOOKCASE.id});
                this.blocks.list.push({move: bc_start_pos.add(new Vector$1(0, 1, 1)), block_id: BLOCK$1.BOOKCASE.id});
            }
        }
    }

    //
    draw(cluster, chunk) {

        const building  = this;
        const dir       = building.door_direction;
        const coord     = building.coord;
        const mat       = building.materials;

        let sign = (dir == DIRECTION.NORTH || dir == DIRECTION.EAST) ? -1 : 1;

        this.drawBasement(cluster, chunk, 4);

        //
        const bx = coord.x - chunk.coord.x;
        const by = coord.y - chunk.coord.y;
        const bz = coord.z - chunk.coord.z;
        
        // 4 walls
        cluster.draw4Walls(chunk, coord, building.size, this.wallBlocks);

        // npc
        const npc_pos = new Vector$1(bx + Math.round(building.size.x/2) + chunk.coord.x, by + chunk.coord.y, bz + Math.round(building.size.z/2) + chunk.coord.z);
        cluster.addNPC(chunk, npc_pos);

        // window
        const window_rot = {x: dir, y: 0, z: 0};
        if(dir == DIRECTION.EAST || dir == DIRECTION.WEST) {
            let w_pos = building.door_bottom.clone().add(new Vector$1(0, 1, 2 * sign));
            cluster.setBlock(chunk, w_pos.x - chunk.coord.x, w_pos.y - chunk.coord.y, w_pos.z - chunk.coord.z, BLOCK$1.GLASS_PANE.id, window_rot);
            w_pos.x += (building.size.x - 1) * sign;
            cluster.setBlock(chunk, w_pos.x - chunk.coord.x, w_pos.y - chunk.coord.y, w_pos.z - chunk.coord.z, BLOCK$1.GLASS_PANE.id, window_rot);
            w_pos.z -= 2 * sign;
            cluster.setBlock(chunk, w_pos.x - chunk.coord.x, w_pos.y - chunk.coord.y, w_pos.z - chunk.coord.z, BLOCK$1.GLASS_PANE.id, window_rot);
        } else if(dir == DIRECTION.NORTH || dir == DIRECTION.SOUTH) {
            let w_pos = building.door_bottom.clone().add(new Vector$1(2 * sign, 1, 0));
            cluster.setBlock(chunk, w_pos.x - chunk.coord.x, w_pos.y - chunk.coord.y, w_pos.z - chunk.coord.z, BLOCK$1.GLASS_PANE.id, window_rot);
            w_pos.z += (building.size.z - 1) * sign;
            cluster.setBlock(chunk, w_pos.x - chunk.coord.x, w_pos.y - chunk.coord.y, w_pos.z - chunk.coord.z, BLOCK$1.GLASS_PANE.id, window_rot);
            w_pos.x -= 2 * sign;
            cluster.setBlock(chunk, w_pos.x - chunk.coord.x, w_pos.y - chunk.coord.y, w_pos.z - chunk.coord.z, BLOCK$1.GLASS_PANE.id, window_rot);
        }
    
        // light
        const light_rot = {x: dir, y: 0, z: 0};
        const l_pos = building.door_bottom.clone().subSelf(chunk.coord);
        l_pos.addByCardinalDirectionSelf(new Vector$1(dir % 2 == 0 ? 1 : -1, 1, -1), dir + 2);
        if(mat.light.id == BLOCK$1.LANTERN.id) {
            light_rot.y = -1;
            l_pos.y += 3;
        }
        cluster.setBlock(chunk, l_pos.x, l_pos.y, l_pos.z, mat.light.id, light_rot);

        // door
        const door_random = new impl(building.door_bottom.toHash());
        cluster.drawDoor(chunk, building.door_bottom, mat.door, dir, door_random.double() > .5, true);

        // draw blocks
        this.drawBlocks(cluster, chunk);

        // roof
        this.drawPitchedRoof(chunk, coord, building.size, dir, mat.roof, mat.roof_block, this.wallBlocks);

    }

}

// BuildingS (small)
class BuildingS extends Building {

    static MAX_SIZES = [5];

    constructor(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size) {
        const orig_coord = coord.clone();
        const orig_size = size.clone();
        Building.limitSize(BuildingS.MAX_SIZES, seed, coord, size, entrance, door_bottom, door_direction, 1);
        //
        aabb = new AABB().set(0, 0, 0, size.x, size.y, size.z).translate(coord.x, coord.y, coord.z).pad(BUILDING_AABB_MARGIN);
        super(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size);
        this.materials  = {
            wall:           BLOCK$1.COBBLESTONE,
            door:           BLOCK$1.SPRUCE_DOOR,
            wall_corner:    BLOCK$1.OAK_TRUNK,
            roof:           BLOCK$1.OAK_STAIRS,
            roof_block:     BLOCK$1.OAK_PLANK,
            light:          BLOCK$1.TORCH
        };
        //
        this.wallBlocks = this.cluster.createPalette([
            {value: this.materials.wall, chance: .33},
            {value: BLOCK$1.ANDESITE, chance: .66},
            {value: BLOCK$1.CONCRETE, chance: 1},
        ]);
        //
        if(orig_size.x > 11 && orig_size.z > 11) {
            // draw fence
            cluster.addFence(orig_coord, orig_size);
            //
            if(this.randoms.double() < .75) {
                const centerOfHay = door_bottom.clone().addByCardinalDirectionSelf(new Vector$1(-10, 0, 6), door_direction + 2);
                const dx = centerOfHay.x - cluster.coord.x;
                const dz = centerOfHay.z - cluster.coord.z;
                this.addHays(dx, dz);
            }
        }
        // Blocks
        const dir                = this.door_direction;
        const mirror_x           = dir % 2 == 1;
        const has_crafting_table = this.randoms.double() <= .4;
        const has_chandelier     = this.randoms.double() <= .8;
        const has_bed            = this.randoms.double() <= .6;
        this.blocks = {
            mirror_x:       mirror_x,
            mirror_z:       false,
            list:           []
        };
        if(this.seed < .7) {
            this.blocks.list.push(...[
                {move: new Vector$1(0, 0, 3), block_id: BLOCK$1.SPRUCE_FENCE.id},
                {move: new Vector$1(0, 1, 3), block_id: BLOCK$1.SPRUCE_TRAPDOOR.id, extra_data: {opened: false, point: {x: 0, y: 0, z: 0}}},
                {move: new Vector$1(1, 0, 3), block_id: BLOCK$1.SPRUCE_STAIRS.id, rotate: {x: (dir + 3 + (mirror_x ? 2 : 0)) % 4, y: 0, z: 0}}
            ]);
        } else {
            this.blocks.list.push({move: new Vector$1(1, 0, 3), block_id: BLOCK$1.SPRUCE_STAIRS.id, rotate: {x: dir, y: 0, z: 0}});
        }
        if(has_crafting_table) {
            this.blocks.list.push({move: new Vector$1(-1, 0, 1), block_id: BLOCK$1.CRAFTING_TABLE.id, rotate: {x: dir, y: 0, z: 0}});
        }
        if(has_chandelier) {
            this.blocks.list.push({move: new Vector$1(0, 3, 2), block_id: BLOCK$1.LANTERN.id, rotate: {x: 0, y: -1, z: 0}});
        }
        // Bed
        if(has_bed) {
            const bed_block_id = 1210 + ((this.randoms.double() * 4) | 0);
            this.blocks.list.push({move: new Vector$1(-1, 0, 1), block_id: bed_block_id, rotate: {x: dir + 0, y: -1, z: 0}, extra_data: {is_head: true}});
            this.blocks.list.push({move: new Vector$1(-1, 0, 2), block_id: bed_block_id, rotate: {x: dir + 2, y: -1, z: 0}});
        }
    }

    //
    draw(cluster, chunk) {

        const building  = this;
        const dir       = building.door_direction;
        const coord     = building.coord;
        const mat       = building.materials;

        this.drawBasement(cluster, chunk, 4, this.materials.wall_corner.id);

        // 4 walls
        cluster.draw4Walls(chunk, coord, building.size, this.wallBlocks);

        // window
        const wrd = Math.floor((building.size.x - 1) / 2);
        const window_rotates = [
            {vec: new Vector$1(wrd, 1, 0), dir: DIRECTION.SOUTH},
            {vec: new Vector$1(0, 1, wrd), dir: DIRECTION.WEST},
            {vec: new Vector$1(wrd, 1, building.size.z - 1), dir: DIRECTION.NORTH},
            {vec: new Vector$1(building.size.x - 1, 1, wrd), dir: DIRECTION.EAST}
        ];
        for(let wr of window_rotates) {
            if(dir == wr.dir) continue;
            let wrot = new Vector$1(wr.dir, 0, 0);
            let wcoord = building.coord.clone().addSelf(wr.vec);
            cluster.setBlock(chunk, wcoord.x - chunk.coord.x, wcoord.y - chunk.coord.y, wcoord.z - chunk.coord.z, BLOCK$1.GLASS_PANE.id, wrot);
        }

        // light
        const light_rot = {x: dir, y: 0, z: 0};
        const l_pos = building.door_bottom.clone().subSelf(chunk.coord);
        l_pos.addByCardinalDirectionSelf(new Vector$1(0, 2, -1), dir + 2);
        cluster.setBlock(chunk, l_pos.x, l_pos.y, l_pos.z, mat.light.id, light_rot);

        // door
        const door_random = new impl(building.door_bottom.toHash());
        cluster.drawDoor(chunk, building.door_bottom, mat.door, dir, door_random.double() > .5, true);

        // draw blocks
        this.drawBlocks(cluster, chunk);

        // wall corners
        const corner_size = new Vector$1(1, building.size.y - 1, 1);
        const corner_coord = building.coord.clone();
        cluster.drawQuboid(chunk, corner_coord, corner_size, mat.wall_corner);
        corner_coord.x += building.size.x - 1;
        cluster.drawQuboid(chunk, corner_coord, corner_size, mat.wall_corner);
        corner_coord.z += building.size.z - 1;
        cluster.drawQuboid(chunk, corner_coord, corner_size, mat.wall_corner);
        corner_coord.x -= building.size.x - 1;
        cluster.drawQuboid(chunk, corner_coord, corner_size, mat.wall_corner);

        // roof
        this.drawPitchedRoof(chunk, coord, building.size, dir, mat.roof, mat.roof_block, this.wallBlocks);

    }

}

const ROAD_DAMAGE_FACTOR    = 0.15;
const USE_ROAD_AS_GANGWAY   = 0;

//
const entranceAhead = new Vector$1(0, 0, 0);
const getAheadMove = (dir) => {
    entranceAhead.set(0, 0, 0);
    if(dir == DIRECTION.NORTH) {entranceAhead.z++;}
    else if(dir == DIRECTION.SOUTH) {entranceAhead.z--;}
    else if(dir == DIRECTION.EAST) {entranceAhead.x++;}
    else {entranceAhead.x--;}
    return entranceAhead;
};

//
class ClusterVilage extends ClusterBase {

    constructor(clusterManager, addr) {
        super(clusterManager, addr);
        this.buildings              = new VectorCollector();
        this.randoms                = new impl(this.id);
        this.use_road_as_gangway    = this.randoms.double() <= USE_ROAD_AS_GANGWAY;
        if(!this.is_empty) {
            this.flat               = this.randoms.double() >= .8;
            this.max_height         = this.flat ? 1 : 30;
            this.wall_block         = this.flat ? BLOCK$1.STONE_BRICK.id : BLOCK$1.OAK_PLANK.id;
            this.road_block         = this.createPalette(this.flat ? [
                {value: BLOCK$1.ANDESITE, chance: .5},
                {value: BLOCK$1.CONCRETE, chance: 1}
            ] : [
                {value: BLOCK$1.DIRT_PATH, chance: 1}
            ]);
            this.road_block.reset();
            this.basement_block     = this.flat ? BLOCK$1.POLISHED_ANDESITE.id : BLOCK$1.COBBLESTONE.id;
            this.building_palette   = this.createBuildingPalette({
                crossroad: [
                    {class: StreetLight, max_count: Infinity, chance: 1}
                ],
                required: [
                    {class: WaterWell, max_count: 1, chance: 1},
                    {class: Farmland, max_count: 1, chance: 1}
                ],
                others: [
                    {class: WaterWell, max_count: 2, chance: 0.12},
                    {class: Farmland, max_count: Infinity, chance: 0.285},
                    {class: Building1, max_count: Infinity, chance: 0.7025},
                    {class: BuildingS, max_count: Infinity, chance: 1}
                ],
            });
            //
            this.timers = {
                generate: 0,
                fill_blocks: 0,
                add_buildings: 0,
                fill_blocks_count: 0
            };
            // generate schema
            let t = performance.now();
            let vs = this.schema = new VilageSchema(this, {
                margin: CLUSTER_PADDING,
                road_damage_factor: this.flat ? 0 : ROAD_DAMAGE_FACTOR
            });
            let resp = vs.generate(this.id);
            this.timers.generate = performance.now() - t; t = performance.now();
            // work with schema
            this.mask = resp.mask;
            for(let house of resp.houses.values()) {
                const size = new Vector$1(house.width, 5, house.depth);
                const entrance_pos = new Vector$1(house.door.x, Infinity, house.door.z);
                const door_bottom = new Vector$1(house.door.x, Infinity, house.door.z);
                this.addBuilding(this.randoms.double(), house.x, house.z, size, entrance_pos, door_bottom, house.door.direction);
            }
            this.timers.add_buildings = performance.now() - t; t = performance.now();
        }
        //
        const moving = this.moveToRandomCorner();
        for(let b of this.buildings) {
            b.translate(moving);
        }
    }

    // createBuildingPalette...
    createBuildingPalette(rules) {
        let that = this;
        let resp = {};
        for(let k in rules) {
            resp[k] = {
                list: rules[k],
                next: function(args) {
                    const r = that.randoms.double();
                    for(let i in this.list) {
                        let b = this.list[i];
                        if (r <= b.chance) {
                            b.max_count--;
                            if(b.max_count <= 0) {
                                this.list.splice(i, 1);
                            }
                            return new b.class(...args);
                        }
                    }
                    throw 'Proportional fill pattern';
                }
            };
        }
        return resp;
    }

    // Add building
    addBuilding(seed, dx, dz, size, entrance, door_bottom, door_direction) {
        let dy = 1;
        const coord = new Vector$1(dx + this.coord.x, dy, dz + this.coord.z);
        if(this.buildings.has(coord)) {
            return false;
        }
        //
        let building_args = [
            this,
            seed,
            coord.clone(),
            new AABB().set(0, 0, 0, size.x, size.y, size.z).translate(coord.x, coord.y, coord.z).pad(BUILDING_AABB_MARGIN),
            entrance.addSelf(this.coord),
            door_bottom.addSelf(this.coord),
            door_direction,
            size
        ];
        // generate random building from palette
        let building = null;
        if(size.x == 1 && size.z == 1) {
            building = this.building_palette.crossroad.next(building_args);
        } else if(this.building_palette.required.list.length > 0) {
            building = this.building_palette.required.next(building_args);
        } else {
            building = this.building_palette.others.next(building_args);
        }
        //
        this.buildings.set(building.coord, building);
        // 1. building mask
        dx = building.coord.x - this.coord.x;
        dz = building.coord.z - this.coord.z;
        for(let i = 0; i < building.size.x; i++) {
            for(let j = 0; j < building.size.z; j++) {
                const x = dx + i;
                const z = dz + j;
                // Draw building basement over heightmap
                this.mask[z * CLUSTER_SIZE.x + x] = new ClusterPoint(building.coord.y, this.basement_block, 3, null, building);
            }
        }
        // 2. entrance mask
        if(building.draw_entrance) {
            let ahead = getAheadMove(building.door_direction);
            const ex = building.entrance.x - this.coord.x + ahead.x;
            const ez = building.entrance.z - this.coord.z + ahead.z;
            this.mask[ez * CLUSTER_SIZE.x + ex] = new ClusterPoint(1, this.basement_block, 3, null, null);
        }
        return true;
    }

    // Fill chunk blocks
    fillBlocks(maps, chunk, map) {
        if(this.is_empty) {
            return false;
        }
        let t = performance.now();
        // each all buildings
        for(let b of this.buildings.values()) {
            if(b.entrance.y == Infinity) {
                b.aabb.y_min = chunk.coord.y - BUILDING_AABB_MARGIN;
                b.aabb.y_max = b.aabb.y_min + b.size.y + BUILDING_AABB_MARGIN * 2;
            }
            // если строение частично или полностью находится в этом чанке
            if(b.aabb.intersect(chunk.aabb)) {
                // у строения до этого момента нет точной информации о вертикальной позиции двери (а значит и пола)
                if(b.entrance.y == Infinity) {
                    // забираем карту того участка, где дверь, чтобы определить точный уровень пола
                    let value2 = 0;
                    for(let entrance of [b.entrance, b.entrance.clone().addSelf(getAheadMove(b.door_direction))]) {
                        const map_addr = getChunkAddr(entrance);
                        map_addr.y = 0;
                        let entrance_map = maps.get(map_addr);
                        if(entrance_map) {
                            // if map not smoothed
                            if(!entrance_map.smoothed) {
                                // generate around maps and smooth current
                                entrance_map = maps.generateAround(chunk, map_addr, true, false)[4];
                            }
                            const entrance_x    = entrance.x - entrance_map.chunk.coord.x;
                            const entrance_z    = entrance.z - entrance_map.chunk.coord.z;
                            const cell          = entrance_map.cells[entrance_z * CHUNK_SIZE_X + entrance_x];
                            if(cell.value2 > value2) {
                                value2 = cell.value2;
                            }
                        }
                    }
                    if(value2 > 0) {
                        b.entrance.y        = value2 - 1;
                        b.coord.y           = b.entrance.y + b.coord.y;
                        b.aabb.y_min        = b.entrance.y - BUILDING_AABB_MARGIN;
                        b.aabb.y_max        = b.aabb.y_min + b.size.y * 3; // + BUILDING_AABB_MARGIN * 5;
                        b.door_bottom.y     = value2;
                    }
                }
                if(b.entrance.y == Infinity) {
                    console.error('Invalid building y');
                } else if(b.aabb.intersect(chunk.aabb)) {
                    this.drawBulding(chunk, maps, b);
                }
            }
        }
        super.fillBlocks(maps, chunk, map);
        //
        this.timers.fill_blocks += performance.now() - t;
        this.timers.fill_blocks_count++;
        // console.log(this.addr.toHash(), this.timers)
    }

    // Draw part of building on map
    drawBulding(chunk, maps, building) {
        const START_X = chunk.coord.x - this.coord.x;
        const START_Z = chunk.coord.z - this.coord.z;
        if(building.hidden) {
            return;
        }
        for(let i = 0; i < building.size.x; i++) {
            let bx = building.coord.x + i;
            // if(bx < chunk.coord.x || bx > chunk.coord.x + chunk.size.x) continue;
            for(let j = 0; j < building.size.z; j++) {
                let bz = building.coord.z + j;
                // if(bz < chunk.coord.z || bz > chunk.coord.z + chunk.size.z) continue;
                const x = bx - chunk.coord.x;
                const z = bz - chunk.coord.z;
                // fix basement height
                const pz = START_Z + z;
                const px = START_X + x;
                if(px >= 0 && pz >= 0 && px < CLUSTER_SIZE.x && pz < CLUSTER_SIZE.z) {
                    let point = this.mask[pz * CLUSTER_SIZE.x + px];
                    if(point && point.height && !point.height_fixed) {
                        // забираем карту того участка, где дверь, чтобы определить точный уровень пола
                        const vec = new Vector$1(building.coord.x + i, 0, building.coord.z + j);
                        const map_addr = getChunkAddr(vec);
                        let bi = maps.get(map_addr);
                        if(bi) {
                            // if map not smoothed
                            if(!bi.smoothed) {
                                // generate around maps and smooth current
                                bi = maps.generateAround(chunk, map_addr, true, false)[4];
                            }
                            const entrance_x    = vec.x - bi.chunk.coord.x;
                            const entrance_z    = vec.z - bi.chunk.coord.z;
                            const cell          = bi.cells[entrance_z * CHUNK_SIZE_X + entrance_x];
                            if(cell.biome.code == 'BEACH' || cell.biome.code == 'OCEAN') {
                                building.hidden = true;
                            }
                            point.height = Math.max(Math.min(point.height, building.coord.y - cell.value2 + 1), 0);
                            point.height_fixed = true;
                        }
                    }
                }
            }
        }
        // draw building
        if(!building.hidden) {
            building.draw(this, chunk);
        }
    }

}

//
class ClusterPyramid extends ClusterBase {

    constructor(clusterManager, addr) {
        super(clusterManager, addr);
        this.max_height  = 1;
        this.is_empty = false;
        if(!this.is_empty) {
            const block = BLOCK$1.MOSSY_STONE_BRICKS;
            let points = new Map();
            const addBlock = (x, z, height) => {
                let point = points.get(height);
                if(!point) {
                    point = new ClusterPoint(height, block.id, 5, null);
                    points.set(height, point);
                }
                this.mask[z * CLUSTER_SIZE.x + x] = point;
            };
            const rad = 32;
            const center = this.size.clone().divScalar(2);
            const p = new Vector$1(0, 0, 0);
            center.y = 0;
            for(let x = 0; x < this.size.x; x++) {
                for(let z = 0; z < this.size.z; z++) {
                    p.set(x, 0, z);
                    let dist = p.distance(center);
                    if(dist < rad && dist > rad / 2) {
                        dist = Math.sin(dist / rad * 2) * rad;
                        if(dist < rad) {
                            addBlock(x, z, Math.round(rad - dist));
                        }
                    }
                }
            }
        }
        //
        const moving = this.moveToRandomCorner();
    }

    // Fill chunk blocks
    fillBlocks(maps, chunk, map) {
        if(this.is_empty) {
            return false;
        }
        super.fillBlocks(maps, chunk, map);
    }

}

//
class ClusterEmpty extends ClusterBase {

    constructor(clusterManager, addr) {
        super(clusterManager, addr);
        this.max_height  = 1;
        this.is_empty = true;
    }

    // Fill chunk blocks
    fillBlocks(maps, chunk, map) {
        return false;
    }

}

// ClusterManager
class ClusterManager {

    // All clusters
    constructor(chunkManager, seed) {
        this.seed = seed;
        this.chunkManager = chunkManager;
        this.all = new VectorCollector();
    }

    // Return cluster
    getForCoord(coord) {
        const addr = new Vector$1(coord.x, coord.y, coord.z).divScalarVec(CLUSTER_SIZE).flooredSelf();
        let cluster = this.all.get(addr);
        if(cluster) {
            return cluster;
        }
        const rand = new impl(this.seed + '_' + addr.toHash());
        const r = rand.double();
        if(r <= .1) {
            cluster = new ClusterPyramid(this, addr.clone());
        } else if(r < .6) {
            cluster = new ClusterEmpty(this, addr.clone());
        } else {
            cluster = new ClusterVilage(this, addr.clone());
        }
        this.all.set(addr, cluster);
        return cluster;
    }

}

// Constants
const DIRTY_REBUILD_RAD = 1;
const BLOCK_CACHE = Array.from({length: 6}, _ => new TBlock(null, new Vector$1(0,0,0)));

// ChunkManager
class ChunkManager {

    constructor(world) {
        this.world = world;
        this.clusterManager = new ClusterManager(this, world.generator.seed);
        this.DUMMY = {
            id: BLOCK$1.DUMMY.id,
            shapes: [],
            properties: BLOCK$1.DUMMY,
            material: BLOCK$1.DUMMY,
            getProperties: function() {
                return this.properties;
            }
        };
        this.dataWorld = new DataWorld();
    }

    // Get
    getChunk(addr) {
        return this.world.chunks.get(addr);
    }

    // Возвращает блок по абсолютным координатам
    getBlock(x, y, z) {
        // определяем относительные координаты чанка
        let chunkAddr = getChunkAddr(x, y, z);
        // обращаемся к чанку
        let chunk = this.getChunk(chunkAddr);
        // если чанк найден
        if(chunk) {
            // просим вернуть блок передав абсолютные координаты
            return chunk.getBlock(x, y, z);
        }
        return this.DUMMY;
    }

}

// Chunk
class Chunk {

    constructor(chunkManager, args) {
        this.chunkManager   = chunkManager;
        Object.assign(this, args);
        this.addr           = new Vector$1(this.addr.x, this.addr.y, this.addr.z);
        this.size           = new Vector$1(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);
        this.coord          = new Vector$1(this.addr.x * CHUNK_SIZE_X, this.addr.y * CHUNK_SIZE_Y, this.addr.z * CHUNK_SIZE_Z);
        this.id             = this.addr.toHash();
        this.ticking_blocks = new VectorCollector();
        this.emitted_blocks = new VectorCollector();
        this.temp_vec2      = new Vector$1(0, 0, 0);
        this.cluster        = chunkManager.clusterManager.getForCoord(this.coord);
        this.aabb           = new AABB();
        this.aabb.set(
            this.coord.x,
            this.coord.y,
            this.coord.z,
            this.coord.x + this.size.x,
            this.coord.y + this.size.y,
            this.coord.z + this.size.z
        );
    }

    init() {
        // Variables
        this.vertices_length    = 0;
        this.vertices           = new Map();
        this.dirty              = true;
        this.fluid_blocks       = [];
        this.gravity_blocks     = [];
        this.timers             = {
            init:               null,
            generate_terrain:   null,
            apply_modify:       null,
            build_vertices:     null
        };
        // 1. Initialise world array
        this.timers.init = performance.now();

        this.tblocks = newTypedBlocks(this.coord, this.size);
        this.chunkManager.dataWorld.addChunk(this);
        //
        this.timers.init = Math.round((performance.now() - this.timers.init) * 1000) / 1000;
        // 2. Generate terrain
        this.timers.generate_terrain = performance.now();
        this.map = this.chunkManager.world.generator.generate(this);
        this.chunkManager.dataWorld.syncOuter(this);
        this.timers.generate_terrain = Math.round((performance.now() - this.timers.generate_terrain) * 1000) / 1000;
        // 3. Apply modify_list
        this.timers.apply_modify = performance.now();
        this.applyModifyList();
        this.timers.apply_modify = Math.round((performance.now() - this.timers.apply_modify) * 1000) / 1000;
        // 4. Result
        return {
            key:        this.key,
            addr:       this.addr,
            tblocks:    this.tblocks,
            map:        this.map
        };
    }

    addTickingBlock(pos) {
        this.ticking_blocks.set(pos, pos);
    }

    deleteTickingBlock(pos) {
        this.ticking_blocks.delete(pos);
    }

    //
    applyModifyList() {
        if(!this.modify_list) {
            return;
        }
        const pos = new Vector$1(0, 0, 0);
        const block_index = new Vector$1(0, 0, 0);
        for(let key of Object.keys(this.modify_list)) {
            let m           = this.modify_list[key];
            let pos_temp         = key.split(',');
            pos.set(pos_temp[0], pos_temp[1], pos_temp[2]);
            if(m.id < 1) {
                BLOCK$1.getBlockIndex(pos, null, null, block_index);
                this.tblocks.delete(block_index);
                continue;
            }
            let type        = BLOCK$1.fromId(m.id);
            let rotate      = m.rotate ? m.rotate : null;
            let entity_id   = m.entity_id ? m.entity_id : null;
            let extra_data  = m.extra_data ? m.extra_data : null;
            this.setBlock(pos.x | 0, pos.y | 0, pos.z | 0, type, false, m.power, rotate, entity_id, extra_data);
        }
        this.modify_list = [];
    }

    // Get the type of the block at the specified position.
    // Mostly for neatness, since accessing the array
    // directly is easier and faster.
    getBlock(ox, oy, oz) {
        let x = ox - this.coord.x;
        let y = oy - this.coord.y;
        let z = oz - this.coord.z;
        if(x < 0 || y < 0 || x > this.size.x - 1 || y > this.size.y - 1 || z > this.size.z - 1) {
            return world.chunkManager.DUMMY;
        };
        if(z < 0 || z >= this.size.y) {
            return world.chunkManager.DUMMY;
        }
        let block = null;
        try {
            // block = this.blocks[x][z][y];
            block = this.tblocks.get(new Vector$1(x, y, z));
        } catch(e) {
            console.error(e);
            console.log(x, y, z);
            debugger;
        }
        if(block == null) {
            return BLOCK$1.AIR;
        }
        return block || world.chunkManager.DUMMY;
    }

    // setBlock
    setBlock(x, y, z, orig_type, is_modify, power, rotate, entity_id, extra_data) {
        // fix rotate
        if(rotate && typeof rotate === 'object') {
            rotate = new Vector$1(rotate).roundSelf(1);
        } else {
            rotate = null;
        }
        // fix power
        if(typeof power === 'undefined' || power === null) {
            power = POWER_NO;
        }
        //
        if(orig_type.id < 3) {
            power       = null;
            rotate      = null;
            extra_data  = null;
        }
        if(power === 0) {
            power = null;
        }
        //
        if(is_modify) {
            let modify_item = {
                id: orig_type.id,
                power: power,
                rotate: rotate
            };
            this.modify_list[[x, y, z]] = modify_item;
        }
        let pos = new Vector$1(x, y, z);
        BLOCK$1.getBlockIndex(pos, null, null, pos);
        x = pos.x;
        y = pos.y;
        z = pos.z;
        if(x < 0 || y < 0 || z < 0 || x > this.size.x - 1 || y > this.size.y - 1 || z > this.size.z - 1) {
            return;
        }
        if(is_modify) {
            console.table(orig_type);
        }
        let block        = this.tblocks.get(pos);
        block.id         = orig_type.id;
        block.power      = power;
        block.rotate     = rotate;
        block.entity_id  = entity_id;
        block.texture    = null;
        block.extra_data = extra_data;
        this.emitted_blocks.delete(block.pos);
    }

    // Set block indirect
    setBlockIndirect(x, y, z, block_id, rotate, extra_data) {
        const { cx, cy, cz, cw, uint16View } = this.tblocks.dataChunk;
        const index = cx * x + cy * y + cz * z + cw;
        uint16View[index] = block_id;
        if (rotate || extra_data) {
            this.tblocks.setBlockRotateExtra(x, y, z, rotate, extra_data);
        }
    }

    // buildVertices
    buildVertices() {

        if(!this.dirty || !this.tblocks || !this.coord) {
            return false;
        }

        // Create map of lowest blocks that are still lit
        let tm = performance.now();

        this.neighbour_chunks = this.tblocks.getNeightboursChunks(world);

        // Check neighbour chunks available
        if(!this.neighbour_chunks.nx || !this.neighbour_chunks.px || !this.neighbour_chunks.ny || !this.neighbour_chunks.py || !this.neighbour_chunks.nz || !this.neighbour_chunks.pz) {
            this.tm                 = performance.now() - tm;
            this.neighbour_chunks   = null;
            console.error('todo_unobtainable_chunk');
            return false;
        }

        let group_templates = {
            regular: {
                list: [],
                is_transparent: false
            },
            transparent: {
                list: [],
                is_transparent: true
            },
            doubleface_transparent: {
                list: [],
                is_transparent: true
            },
            doubleface: {
                list: [],
                is_transparent: true
            },
        };

        this.fluid_blocks           = [];
        this.gravity_blocks         = [];
        this.vertices               = new Map(); // Add vertices for blocks

        // addVerticesToGroup...
        const addVerticesToGroup = (material_group, material_key, vertices) => {
            if(!this.vertices.has(material_key)) {
                // {...group_templates[material.group]}; -> Не работает так! list остаётся ссылкой на единый массив!
                this.vertices.set(material_key, JSON.parse(JSON.stringify(group_templates[material_group])));
            }
            // Push vertices
            this.vertices.get(material_key).list.push(...vertices);
        };

        const cache                 = BLOCK_CACHE;
        const blockIter             = this.tblocks.createUnsafeIterator(new TBlock(null, new Vector$1(0,0,0)), true);

        this.quads = 0;

        // Обход всех блоков данного чанка
        for(let block of blockIter) {
            const material = block.material;
            // @todo iterator not fired air blocks
            if(block.id == BLOCK$1.AIR.id || !material || material.item) {
                if(this.emitted_blocks.has(block.pos)) {
                    this.emitted_blocks.delete(block.pos);
                }
                continue;
            }
            // собираем соседей блока, чтобы на этой базе понять, дальше отрисовывать стороны или нет
            let neighbours = block.getNeighbours(world, cache);
            // если у блока все соседи есть и они непрозрачные, значит блок невидно и ненужно отрисовывать
            if(neighbours.pcnt == 6 || neighbours.water_in_water) {
                continue;
            }
            let vertices = block.vertices;
            if(vertices === null) {
                vertices = [];
                const cell = this.map.cells[block.pos.z * CHUNK_SIZE_X + block.pos.x];
                const resp = material.resource_pack.pushVertices(
                    vertices,
                    block, // UNSAFE! If you need unique block, use clone
                    this,
                    block.pos,
                    neighbours,
                    cell.biome,
                    cell.dirt_color
                );
                if(Array.isArray(resp)) {
                    this.emitted_blocks.set(block.pos, resp);
                } else if(this.emitted_blocks.size > 0) {
                    this.emitted_blocks.delete(block.pos);
                }
                block.vertices = vertices;
            }
            world.blocks_pushed++;
            if(vertices.length > 0) {
                this.quads++;
                addVerticesToGroup(material.group, material.material_key, vertices);
            }
        }

        // Emmited blocks
        if(this.emitted_blocks.size > 0) {
            const fake_neighbours = new BlockNeighbours();
            for(let eblocks of this.emitted_blocks) {
                for(let eb of eblocks) {
                    let vertices = [];
                    const material = eb.material;
                    // vertices, block, world, pos, neighbours, biome, dirt_color, draw_style, force_tex, _matrix, _pivot
                    material.resource_pack.pushVertices(
                        vertices,
                        eb,
                        this,
                        eb.pos,
                        fake_neighbours,
                        eb.biome,
                        eb.dirt_color,
                        null,
                        null,
                        eb.matrix,
                        eb.pivot
                    );
                    if(vertices.length > 0) {
                        this.quads++;
                        addVerticesToGroup(material.group, material.material_key, vertices);
                    }
                }
            }
        }

        /*for(let k of this.vertices.keys()) {
            const group = this.vertices.get(k);
            group.list = new Float32Array(group.list);
        }*/

        // console.log(this.quads);
        this.dirty = false;
        this.tm = performance.now() - tm;
        this.neighbour_chunks = null;
        return true;

    }

    // setDirtyBlocks
    // Вызывается, когда какой нибудь блок уничтожили (вокруг него все блоки делаем испорченными)
    setDirtyBlocks(pos) {
        let dirty_rad = DIRTY_REBUILD_RAD;
        let cnt = 0;
        for(let cx = -dirty_rad; cx <= dirty_rad; cx++) {
            for(let cz = -dirty_rad; cz <= dirty_rad; cz++) {
                for(let cy = -dirty_rad; cy <= dirty_rad; cy++) {
                    let x = pos.x + cx;
                    let y = pos.y + cy;
                    let z = pos.z + cz;
                    if(x >= 0 && y >= 0 && z >= 0 && x < this.size.x && y < this.size.y && z < this.size.z) {
                        let pos = new Vector$1(x, y, z);
                        if(this.tblocks.has(pos)) {
                            let block = this.tblocks.get(pos);
                            if(block.material.gravity) {
                                if(cy == 1 && cx == 0 && cz == 0) {
                                    block.falling = true;
                                }
                            }
                            if(block.vertices) {
                                block.vertices = null;
                                cnt++;
                            }
                        }
                    }
                }
            }
        }
        return cnt;
    }

}

// WorkerWorldManager
class WorkerWorldManager {

    constructor() {
        this.list = new Map();
    }

    async InitTerrainGenerators(generator_codes) {
        // generator_codes = ['biome2', 'city', 'city2', 'flat'];
        let that = this;
        that.terrainGenerators = new Map();
        let all = [];
        // Load terrain generators
        Promise.resolve().then(function () { return index$5; }).then(module => 
            {
            that.terrainGenerators.set('biome2', module.default);
        });
        
        for(let tg_code of generator_codes) {
            switch (tg_code) {
                case 'biome2':
                      all.push(Promise.resolve().then(function () { return index$5; }).then(module => 
                          {
                              that.terrainGenerators.set('biome2', module.default);
                          }));
                      break;
                  case 'city':
                      all.push(Promise.resolve().then(function () { return index$4; }).then(module => {that.terrainGenerators.set('city', module.default);}));
                      break;
                  case 'city2':
                      all.push(Promise.resolve().then(function () { return index$3; }).then(module => {that.terrainGenerators.set('city2', module.default);}));
                      break;                       
                  case 'flat':
                      all.push(Promise.resolve().then(function () { return index$2; }).then(module => {that.terrainGenerators.set('flat', module.default);}));
                      break;
                  case 'mine':
                      all.push(Promise.resolve().then(function () { return index$1; }).then(module => {that.terrainGenerators.set('mine', module.default);}));
                      break;
                  case 'test_trees':
                      all.push(Promise.resolve().then(function () { return index; }).then(module => {that.terrainGenerators.set('test_trees', module.default);}));
                      break;
                      /*
                  default:
                     import('../terrain_generator/' + tg_code + '/index.js').then((module) => {
                          that.terrainGenerators.set(tg_code, module.default);
                      });
                      break;*/
             }
                    
                    
        }
        await Promise.all(all);
    }

    async add(g, seed, world_id) {
        const generator_options = g?.options || {};
        const generator_id = g.id;
        let key = generator_id + '/' + seed;
        if(this.list.has(key)) {
            return this.list.get(key);
        }
        let generator = this.terrainGenerators.get(generator_id);
        generator = new generator(seed, world_id, generator_options);
        await generator.init();
        let world = new WorkerWorld(generator);
        this.list.set(key, world);
        return world;
    }

}

// World
class WorkerWorld {

    constructor(generator) {
        this.generator = generator;
        this.chunkManager = new ChunkManager(this);
        this.chunks = new VectorCollector();
    }

    createChunk(args) {
        if(this.chunks.has(args.addr)) {
            return this.chunks.get(args.addr);
        }
        let chunk = new Chunk(this.chunkManager, args);
        chunk.init();
        this.chunks.add(args.addr, chunk);
        // console.log(`Actual chunks count: ${this.chunks.size}`);
        // Ticking blocks
        let ticking_blocks = [];
        for(let k of chunk.ticking_blocks.keys()) {
            ticking_blocks.push(k.toHash());
        }
        // Return chunk object
        return {
            key:            chunk.key,
            addr:           chunk.addr,
            tblocks:        chunk.tblocks,
            ticking_blocks: ticking_blocks,
            map:            chunk.map
        };
    }

    destructChunk(addr) {
        const chunk = this.chunks.get(addr);
        if(chunk) {
            this.chunks.delete(addr);
            this.generator.maps.delete(addr);

            this.chunkManager.dataWorld.removeChunk(chunk);

            return true;
        }
        return false;
    }

    getChunk(addr) {
        return this.chunks.get(addr) || null;
    }

    // Return generator options
    getGeneratorOptions(key, default_value) {
        const generator_options = this.generator.options;
        if(generator_options) {
            if(key in generator_options) {
                return generator_options[key];
            }
        }
        return default_value;
    }

}

var world$1 = /*#__PURE__*/Object.freeze({
	__proto__: null,
	WorkerWorldManager: WorkerWorldManager,
	WorkerWorld: WorkerWorld
});

const {mat4: mat4$a} = glMatrix$1;

const w = 1;
const h = 1;

const WIDTH_INNER$2 = 4/16;

// Azalea
class style$o {

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['azalea'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block, for_physic) {
        let y = 0;
        let aabb = new AABB();
        aabb.set(
            0 + .5 - w / 2,
            y + .5,
            0 + .5 - w / 2,
            0 + .5 + w / 2,
            y + 1,
            0 + .5 + w / 2,
        );
        let aabb2 = new AABB();
        aabb2.set(
            0 + .5 - WIDTH_INNER$2 / 2,
            y + 0,
            0 + .5 - WIDTH_INNER$2 / 2,
            0 + .5 + WIDTH_INNER$2 / 2,
            y + .5,
            0 + .5 + WIDTH_INNER$2 / 2,
        );
        return [aabb, aabb2];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK$1.AIR.id) {
            return;
        }

        const c_up = BLOCK$1.calcMaterialTexture(block.material, DIRECTION.UP);
        const c_side = BLOCK$1.calcMaterialTexture(block.material, DIRECTION.NORTH);
        const c_down = BLOCK$1.calcMaterialTexture(block.material, DIRECTION.DOWN);

        const chains = [];
        chains.push({width: w, height: h, uv: [.5, .5], rot: Math.PI / 4, y: 0, translate: [w/2, 0, 0]});
        chains.push({width: w, height: h, uv: [.5, .5], rot: -Math.PI / 4, y: 0, translate: [-w/2, 0, 0]});

        const CHAIN_Y = y;

        for(let chain of chains) {
            const aabb_chain_middle = new AABB();
            aabb_chain_middle.set(
                x + .5 - chain.width/2,
                CHAIN_Y + chain.y,
                z + .5 - chain.width/2,
                x + .5 + chain.width/2,
                CHAIN_Y + chain.y + chain.height,
                z + .5 + chain.width/2,
            );
            // Push vertices
            matrix = mat4$a.create();
            mat4$a.rotateY(matrix, matrix, chain.rot);
            mat4$a.translate(matrix, matrix, chain.translate);
            pushAABB(
                vertices,
                aabb_chain_middle,
                pivot,
                matrix,
                {north:  new AABBSideParams(c_down, 0, 1, null, null, true)},
                new Vector$1(x, y, z)
            );
        }

        //
        matrix = mat4$a.create();

        const aabb_up = new AABB();
        aabb_up.set(
            x,
            y,
            z,
            x + 1,
            y + 1,
            z + 1
        );

        // Push vertices down
        pushAABB(
            vertices,
            aabb_up,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c_up, 0, 1, null, null, true),
                south:  new AABBSideParams(c_side, 0, 1, null, null, true),
                north:  new AABBSideParams(c_side, 0, 1, null, null, true),
                west:   new AABBSideParams(c_side, 0, 1, null, null, true),
                east:   new AABBSideParams(c_side, 0, 1, null, null, true),
            },
            new Vector$1(x, y, z)
        );

        return null;

    }

}

var azalea = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': style$o
});

const {mat4: mat4$9} = glMatrix$1;

const STALK_WIDTH = 6/32;
const TX_CNT$3 = 32;

let randoms$8 = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a$8 = new impl('random_plants_position');
for(let i = 0; i < randoms$8.length; i++) {
    randoms$8[i] = a$8.double();
}

const _temp_shift_pos$1 = new Vector$1(0, 0, 0);

// Bamboo
class style$n {

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['bamboo'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block, for_physic) {

        let x = 0;
        let y = 0;
        let z = 0;
        let margin = 0;

        margin = for_physic ? 0 : 1/16;

        _temp_shift_pos$1.copyFrom(block.posworld).subSelf(block.tb.coord);

        // Random shift
        const index = Math.abs(Math.round(_temp_shift_pos$1.x * CHUNK_SIZE_Z + _temp_shift_pos$1.z)) % 256;
        const r = randoms$8[index] * 4/16 - 2/16;
        x += 0.5 - 0.5 + r;
        z += 0.5 - 0.5 + r;

        let aabb = new AABB();
        aabb.set(
            x + .5 - STALK_WIDTH / 2 - margin,
            y + 0,
            z + .5 - STALK_WIDTH / 2 - margin,
            x + .5 + STALK_WIDTH / 2 + margin,
            y + 1,
            z + .5 + STALK_WIDTH / 2 + margin,
        );
        return [aabb];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK$1.AIR.id) {
            return;
        }

        let stage = block?.extra_data ? block.extra_data.stage : 3;

        const no_random_pos = block.hasTag('no_random_pos');
        const into_pot = block.hasTag('into_pot');

        // Random shift
        if(!no_random_pos) {
            const index = Math.abs(Math.round(x * CHUNK_SIZE_Z + z)) % 256;
            const r = randoms$8[index] * 4/16 - 2/16;
            x += 0.5 - 0.5 + r;
            z += 0.5 - 0.5 + r;
        }

        const textures = {
            stalk:          BLOCK$1.calcMaterialTexture(block.material, DIRECTION.UP), // стебель
            stage0:         BLOCK$1.calcMaterialTexture(block.material, DIRECTION.EAST), // первая стадия роста
            singleleaf:     BLOCK$1.calcMaterialTexture(block.material, DIRECTION.WEST), // одинокий листик
            leaves:         BLOCK$1.calcMaterialTexture(block.material, DIRECTION.SOUTH), // малая листва
            large_leaves:   BLOCK$1.calcMaterialTexture(block.material, DIRECTION.NORTH) // широкая листва
        };

        if(into_pot) {
            stage = 4;
            y -= 6/32 - 1/500;
        }

        const pos = new Vector$1(x, y, z);
        const chains = [];

        switch(stage) {
            case 0: {
                chains.push({
                    pos: pos,
                    width: 1,
                    height: 1,
                    uv: [.5, .5],
                    rot: Math.PI / 4,
                    translate: [.5, 0, 0],
                    texture: textures.stage0
                });
                chains.push({
                    pos: pos,
                    width: 1,
                    height: 1,
                    uv: [.5, .5],
                    rot: -Math.PI / 4,
                    translate: [-.5, 0, 0],
                    texture: textures.stage0
                });
                break;
            }
            case 1:
            case 2: {
                chains.push({
                    pos: pos,
                    width: 1,
                    height: 1,
                    uv: [.5, .5],
                    rot: 0,
                    translate: [0, 0, -.5],
                    texture: stage == 1 ? textures.leaves : textures.large_leaves
                });
                chains.push({
                    pos: pos,
                    width: 1,
                    height: 1,
                    uv: [.5, .5],
                    rot: Math.PI / 2,
                    translate: [0, 0, .5],
                    texture: stage == 1 ? textures.leaves : textures.large_leaves
                });
                break;
            }
            case 3: {
                break;
            }
            case 4: {
                chains.push({
                    pos: pos,
                    width: 1,
                    height: 1,
                    uv: [.5, .5],
                    rot: 0,
                    translate: [0, 0, -.5],
                    texture: textures.singleleaf
                });
                break;
            }
        }

        style$n.pushChains(vertices, chains);

        if(stage > 0) {
            //
            matrix = mat4$9.create();

            const aabb = new AABB();
            aabb.set(
                x + .5 - STALK_WIDTH/2,
                y,
                z + .5 - STALK_WIDTH/2,
                x + .5 + STALK_WIDTH/2,
                y + 1,
                z + .5 + STALK_WIDTH/2
            );

            const c_up = [...textures.stalk];
            const c_side = [...textures.stalk];

            c_up[0] += (-.5 + 29/32) / TX_CNT$3;
            c_up[1] += (-.5 + 3/32) / TX_CNT$3;

            c_side[0] += (-.5 + 3/32) / TX_CNT$3;

            // Push vertices down
            pushAABB(
                vertices,
                aabb,
                pivot,
                matrix,
                {
                    up:     new AABBSideParams(c_up, 0, 1, null, null, true),
                    down:   new AABBSideParams(c_up, 0, 1, null, null, true),
                    south:  new AABBSideParams(c_side, 0, 1, null, null, true),
                    north:  new AABBSideParams(c_side, 0, 1, null, null, true),
                    west:   new AABBSideParams(c_side, 0, 1, null, null, true),
                    east:   new AABBSideParams(c_side, 0, 1, null, null, true),
                },
                pos
            );
        }

        return null;

    }

    //
    static pushChains(vertices, chains) {
        const _aabb_chain_middle = new AABB();
        let pivot = null;
        let matrix = null;
        for(let chain of chains) {
            _aabb_chain_middle.set(
                chain.pos.x + .5 - chain.width/2,
                chain.pos.y,
                chain.pos.z + .5 - chain.width/2,
                chain.pos.x + .5 + chain.width/2,
                chain.pos.y + chain.height,
                chain.pos.z + .5 + chain.width/2,
            );
            // Push vertices
            matrix = mat4$9.create();
            if(chain.rot) mat4$9.rotateY(matrix, matrix, chain.rot);
            if(chain.translate) mat4$9.translate(matrix, matrix, chain.translate);
            pushAABB(
                vertices,
                _aabb_chain_middle,
                pivot,
                matrix,
                {north: new AABBSideParams(chain.texture, 0, 1, null, null, true)},
                chain.pos
            );
        }
    }

}

var bamboo = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': style$n
});

const {mat4: mat4$8} = glMatrix$1;

const WIDTH$4             =  1;
const MATTRESS_HEIGHT   = 12/32;
const LEG_WIDTH         = 6/32;
const LEG_HEIGHT        = 6/32;
const HEIGHT$4            = MATTRESS_HEIGHT + LEG_HEIGHT;

let randoms$7 = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a$7 = new impl('random_plants_position');
for(let i = 0; i < randoms$7.length; i++) {
    randoms$7[i] = a$7.double();
}

// Кровать
class style$m {

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['bed'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block, for_physic) {
        let aabb = new AABB();
        aabb.set(
            0 + .5 - WIDTH$4 / 2,
            0,
            0 + .5 - WIDTH$4 / 2,
            0 + .5 + WIDTH$4 / 2,
            0 + HEIGHT$4,
            0 + .5 + WIDTH$4 / 2,
        );
        if(!for_physic) {
            aabb.pad(1 / 500);
        }
        return [aabb];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK$1.AIR.id) {
            return;
        }

        const sz = 1024;
        const is_head = !!block.extra_data?.is_head;

        // matrix
        matrix = mat4$8.create();
        if(block.rotate) {
            let rot = block.rotate.x;
            if(is_head) {
                rot += 2;
            }
            mat4$8.rotateY(matrix, matrix, ((rot % 4) / 4) * (2 * Math.PI));
        }

        // mattress
        let aabb_mattress = new AABB();
        aabb_mattress.set(
            x + .5 - WIDTH$4/2,
            y,
            z + .5 - WIDTH$4/2,
            x + .5 + WIDTH$4/2,
            y + MATTRESS_HEIGHT,
            z + .5 + WIDTH$4/2,
        ).translate(0, LEG_HEIGHT, 0);

        // flags
        const flags = QUAD_FLAGS.MASK_BIOME;
        const lm = block.material.mask_color.clone();
        const mask_shift = lm.b = 4;

        // textures
        const c_head = BLOCK$1.calcMaterialTexture(block.material, DIRECTION.SOUTH);
        // IMPORTANT! c_head positions must be 0x0 coord in bed texture
        c_head[0] -= 16/sz;
        c_head[1] -= 16/sz;
        c_head[2] *= -1;
        c_head[3] *= -1;

        // up
        const c_up = is_head ? [
            c_head[0] + 28/sz,
            c_head[1] + 28/sz,
            c_head[2],
            c_head[3],
        ] : [
            c_head[0] + 28/sz,
            c_head[1] + 72/sz,
            c_head[2],
            c_head[3],
        ];

        // down
        const c_down = [
            c_head[0] + 72/sz,
            c_head[1] + 28/sz,
            c_head[2],
            c_head[3],
        ];

        // south
        const c_south = [
            c_head[0] + 28/sz,
            c_head[1] + 6/sz,
            32/sz,
            -12/sz,
        ];

        // north
        const c_north = [
            c_head[0] + 60/sz,
            c_head[1] + 50/sz,
            32/sz,
            12/sz,
        ];

        // west
        const west_axes = [ [0, 0, 1], [0, 1, 0] ];
        const c_west = [
            c_head[0] + 50/sz,
            c_head[1] + (is_head ? 28/sz : 72/sz),
            -12/sz,
            -32/sz,
        ];

        // east
        const east_axes = [ [0, 0, -1], [0, 1, 0] ];
        const c_east = [
            c_head[0] + 6/sz,
            c_head[1] + (is_head ? 28/sz : 72/sz),
            -12/sz,
            -32/sz,
        ];

        // push mattress vertices
        pushAABB(
            vertices,
            aabb_mattress,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c_up, flags, mask_shift, lm, null, true),
                down:   new AABBSideParams(c_down, 0, mask_shift, null, null, true),
                south:  new AABBSideParams(c_south, flags, mask_shift, lm, null, false),
                north:  new AABBSideParams(c_north, flags, mask_shift, lm, null, false),
                west:   new AABBSideParams(c_west, flags, mask_shift, lm, west_axes, false),
                east:   new AABBSideParams(c_east, flags, mask_shift, lm, east_axes, false),
            },
            new Vector$1(x, y, z)
        );

        for(let leg of style$m.addLegs(sz, x, y, z, is_head, c_head, flags, mask_shift, lm)) {
            // push mattress vertices
            pushAABB(
                vertices,
                leg.aabb,
                pivot,
                matrix,
                leg.sides,
                new Vector$1(x, y, z)
            );
        }

        return null;

    }

    static addLegs(sz, x, y, z, is_head, c_head, flags, mask_shift, lm) {

        const resp = [];

        const ops = [
            {
                texY: 0 + (is_head ? 24 : 0),
                moveX: 0,
                moveZ: is_head ? 0 : (1 - LEG_WIDTH),
                index: is_head ? 0 : 2
            },
            {
                texY: 12 + (is_head ? 24 : 0),
                moveX: 1 - LEG_WIDTH,
                moveZ: is_head ? 0 : (1 - LEG_WIDTH),
                index: is_head ? 1 : 3
            }
        ];

        for(let op of ops) {
            let left_aabb = new AABB();
            left_aabb.set(x, y, z, x + LEG_WIDTH, y + LEG_HEIGHT, z + LEG_WIDTH);
            left_aabb.translate(op.moveX, 0, op.moveZ);

            const c_down    = [c_head[0] + 115/sz, c_head[1] + (op.texY + 3)/sz, 6/sz, 6/sz];
            const c_south   = [c_head[0] + 109/sz, c_head[1] + (op.texY + 9)/sz, 6/sz, 6/sz];
            const c_east    = [c_head[0] + 115/sz, c_head[1] + (op.texY + 9)/sz, 6/sz, 6/sz];
            const c_north   = [c_head[0] + 121/sz, c_head[1] + (op.texY + 9)/sz, -6/sz, -6/sz];
            const c_west    = [c_head[0] + 103/sz, c_head[1] + (op.texY + 9)/sz, -6/sz, 6/sz];

            let cc = null;
            if(op.index == 0) {
                cc = [c_south, c_east, c_north, c_west];
            } else if(op.index == 1) {
                cc = [c_west, c_south, c_east, c_north];
                cc[0][2] *= -1;
                cc[2][2] *= -1;
            } else if(op.index == 2) {
                cc = [c_east, c_north, c_west, c_south];
                cc[1][2] *= -1;
                cc[3][2] *= -1;
            } else if(op.index == 3) {
                cc = [c_north, c_west, c_south, c_east];
                cc[0][2] *= -1;
                cc[1][2] *= -1;
                cc[2][2] *= -1;
                cc[3][2] *= -1;
            } else {
                continue;
            }

            const left_sides = {
                down:   new AABBSideParams(c_down, flags, mask_shift, lm, null, false),
                south:  new AABBSideParams(cc[0], flags, mask_shift, lm, null, false),
                east:   new AABBSideParams(cc[1], flags, mask_shift, lm, null, false),
                north:  new AABBSideParams(cc[2], flags, mask_shift, lm, null, false),
                west:   new AABBSideParams(cc[3], flags, mask_shift, lm, null, false),
            };
            resp.push({aabb: left_aabb, sides: left_sides});
        }

        return resp;

    }

}

var bed = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': style$m
});

const {mat4: mat4$7} = glMatrix$1;

const TX_CNT$2    = 32;
const SIZE      = 28;
const PPB       = 32; // pixels in texture per block
const WIDTH$3     = SIZE/PPB;
const HEIGHT$3    = 16/PPB;

// Azalea
class style$l {

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['cake'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block, for_physic, no_pad) {

        const pieces = block?.extra_data?.pieces || 7;
        const percent = (pieces * 4) / SIZE;

        let w = WIDTH$3;
        let x = 0;
        let y = 0;
        let z = 0;

        if(percent < 1) {
            w *= percent;
        }

        const aabb = new AABB();
        aabb.set(
            x + .5 - WIDTH$3/2,
            y,
            z + .5 - WIDTH$3/2,
            x + .5 - WIDTH$3/2 + w,
            y + HEIGHT$3,
            z + .5 + WIDTH$3/2,
        );

        if(!no_pad) {
            aabb.pad(1/500);
        }

        return [aabb];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK$1.AIR.id) {
            return;
        }

        const pieces = block?.extra_data?.pieces || 7;
        const percent = (pieces * 4) / SIZE;

        const c_up = BLOCK$1.calcMaterialTexture(block.material, DIRECTION.UP);
        const c_side = BLOCK$1.calcMaterialTexture(block.material, DIRECTION.FORWARD);
        const c_down = BLOCK$1.calcMaterialTexture(block.material, DIRECTION.DOWN);
        let c_east = c_side;

        c_side[0] += (-.5 + 16/PPB) / TX_CNT$2;
        c_side[1] += (-.5 + 24/PPB) / TX_CNT$2;

        const c_south = [...c_side];
        const c_north = [...c_side];

        //
        matrix = mat4$7.create();

        if(percent < 1) {
            c_east = BLOCK$1.calcMaterialTexture(block.material, DIRECTION.RIGHT);
            c_east[0] += (-.5 + 16/PPB) / TX_CNT$2;
            c_east[1] += (-.5 + 24/PPB) / TX_CNT$2;
            c_up[0] -= ((1 - percent) * SIZE / PPB) / TX_CNT$2 / 2;
            c_south[0] -= ((1 - percent) * SIZE / PPB) / TX_CNT$2 / 2;
            c_north[0] += ((1 - percent) * SIZE / PPB) / TX_CNT$2 / 2;
        }

        const aabb = style$l.computeAABB(block, true, true)[0];
        aabb.translate(x, y, z);

        // Push vertices down
        pushAABB(
            vertices,
            aabb,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c_up, 0, 1, null, null, true),
                down:   new AABBSideParams(c_down, 0, 1, null, null, true),
                south:  new AABBSideParams(c_south, 0, 1, null, null, true),
                north:  new AABBSideParams(c_north, 0, 1, null, null, true),
                west:   new AABBSideParams(c_side, 0, 1, null, null, true),
                east:   new AABBSideParams(c_east, 0, 1, null, null, true),
            },
            new Vector$1(x, y, z)
        );

        return null;

    }

}

var cake = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': style$l
});

const {mat4: mat4$6} = glMatrix$1;

const TX_CNT$1 = 32;

const PLANKS_WIDTH = 1;
const PLANKS_HEIGHT = 8/32;

let randoms$6 = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a$6 = new impl('random_plants_position');
for(let i = 0; i < randoms$6.length; i++) {
    randoms$6[i] = a$6.double();
}

const _temp_shift_pos = new Vector$1(0, 0, 0);

// Костёр
class style$k {

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['campfire'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block, for_physic) {
        let y = 0;
        let aabb = new AABB();
        const w = 1;
        const h = .5;
        aabb.set(
            0 + .5 - w / 2,
            y,
            0 + .5 - w / 2,
            0 + .5 + w / 2,
            y + h,
            0 + .5 + w / 2,
        );
        return [aabb];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        const textures = {
            fire:  BLOCK$1.calcMaterialTexture(block.material, DIRECTION.UP), // пламя
            stone:  BLOCK$1.calcMaterialTexture(block.material, DIRECTION.DOWN), // камень
            planks: BLOCK$1.calcMaterialTexture(block.material, DIRECTION.DOWN) // доски, угли
        };

        worker.postMessage(['add_torch', {
            block_pos: block.posworld,
            pos: block.posworld,
            type: 'campfire'
        }]);

        matrix = mat4$6.create();
        if(block.rotate) {
            mat4$6.rotateY(matrix, matrix, ((block.rotate.x - 1) / 4) * -(2 * Math.PI));
        }

        const pos = new Vector$1(x, y, z);
        const active = block?.extra_data?.active;

        const aabb_stone = new AABB();
        aabb_stone.set(
            x,
            y,
            z + 1/16 + PLANKS_HEIGHT,
            x + 1,
            y + 1/16,
            z + 1/16 + PLANKS_HEIGHT + 6/16
        );
        const c_stone = [...textures.planks];
        c_stone[0] += (-.5 + 16/32) / TX_CNT$1;
        c_stone[1] += (-.5 + 24/32) / TX_CNT$1;

        pushAABB(
            vertices,
            aabb_stone,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c_stone, 0, 1, null, null, true),
                down:   new AABBSideParams(c_stone, 0, 1, null, null, true),
                south:  new AABBSideParams(c_stone, 0, 1, null, null, true),
                north:  new AABBSideParams(c_stone, 0, 1, null, null, true),
                west:   new AABBSideParams(c_stone, 0, 1, null, null, true),
                east:   new AABBSideParams(c_stone, 0, 1, null, null, true),
            },
            pos
        );

        // Пламя
        if(active) {
            const chains = [];
            const flame_animations = BLOCK$1.getAnimations(block.material, 'up');
            chains.push({
                pos: pos,
                width: 1,
                height: 1,
                uv: [.5, .5],
                rot: Math.PI / 4,
                translate: [.5, 0, 0],
                sides: {north: new AABBSideParams(textures.fire, QUAD_FLAGS.FLAG_ANIMATED, flame_animations, null, null, true)},
                anim: 8
            });
            chains.push({
                pos: pos,
                width: 1,
                height: 1,
                uv: [.5, .5],
                rot: -Math.PI / 4,
                translate: [-.5, 0, 0],
                sides: {north: new AABBSideParams(textures.fire, QUAD_FLAGS.FLAG_ANIMATED, flame_animations, null, null, true)},
                anim: 8
            });
            style$k.pushChains(vertices, chains);
        }

        // Доски
        const aabb = new AABB();
        aabb.set(
            x,
            y,
            z + 1/16,
            x + 1,
            y + PLANKS_HEIGHT,
            z + 1/16 + PLANKS_HEIGHT
        );
        const c_planks_side = [...textures.planks];
        const c_planks_ends = [...textures.planks];
        c_planks_side[0] += (-.5 + 16/32) / TX_CNT$1;
        c_planks_side[1] += (-.5 + 4/32) / TX_CNT$1;
        c_planks_ends[0] += (-.5 + 4/32) / TX_CNT$1;
        c_planks_ends[1] += (-.5 + 12/32) / TX_CNT$1;

        // Варианты досок
        const planks_variants = [];
        // 1.
        planks_variants.push({matrix: matrix});
        // 2.
        const matrix2 = [...matrix];
        mat4$6.rotateY(matrix2, matrix2, Math.PI);
        planks_variants.push({matrix: matrix2});
        // 3.
        const matrix3 = [...matrix];
        mat4$6.rotateY(matrix3, matrix3, Math.PI / 2);
        mat4$6.translate(matrix3, matrix3, [0, PLANKS_HEIGHT - 1/16, 0]);
        planks_variants.push({matrix: matrix3});
        // 4.
        const matrix4 = [...matrix];
        mat4$6.rotateY(matrix4, matrix4, Math.PI * 1.5);
        mat4$6.translate(matrix4, matrix4, [0, PLANKS_HEIGHT - 1/16, 0]);
        planks_variants.push({matrix: matrix4});

        // Push planks vertices
        for(let item of planks_variants) {
            pushAABB(
                vertices,
                aabb,
                pivot,
                item.matrix,
                {
                    up:     new AABBSideParams(c_planks_side, 0, 1, null, null, true),
                    down:   new AABBSideParams(c_planks_side, 0, 1, null, null, true),
                    south:  new AABBSideParams(c_planks_side, 0, 1, null, null, true),
                    north:  new AABBSideParams(c_planks_side, 0, 1, null, null, true),
                    west:   new AABBSideParams(c_planks_ends, 0, 1, null, null, true),
                    east:   new AABBSideParams(c_planks_ends, 0, 1, null, null, true),
                },
                pos
            );
        }

        return null;

    }

    //
    static pushChains(vertices, chains, anim) {
        const _aabb_chain_middle = new AABB();
        let pivot = null;
        let matrix = null;
        for(let chain of chains) {
            _aabb_chain_middle.set(
                chain.pos.x + .5 - chain.width/2,
                chain.pos.y,
                chain.pos.z + .5 - chain.width/2,
                chain.pos.x + .5 + chain.width/2,
                chain.pos.y + chain.height,
                chain.pos.z + .5 + chain.width/2,
            );
            // Push vertices
            matrix = mat4$6.create();
            if(chain.rot) mat4$6.rotateY(matrix, matrix, chain.rot);
            if(chain.translate) mat4$6.translate(matrix, matrix, chain.translate);
            pushAABB(
                vertices,
                _aabb_chain_middle,
                pivot,
                matrix,
                chain.sides,
                chain.pos
            );
        }
    }

}

var campfire = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': style$k
});

const TX_CNT = 32;
const TX_SIZE = 16;

const {mat4: mat4$5} = glMatrix$1;

let randoms$5 = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a$5 = new impl('random_plants_position');
for(let i = 0; i < randoms$5.length; i++) {
    randoms$5[i] = a$5.double();
}

//
class style$j {

    //
    static pushPlane(vertices, plane) {

        const pivot = null;

        const width = plane.size.x / TX_SIZE;
        const height = plane.size.y / TX_SIZE;
        const depth = plane.size.z / TX_SIZE;

        const aabb = new AABB();
        aabb.set(
            plane.pos.x + .5,
            plane.pos.y + .5,
            plane.pos.z + .5,
            plane.pos.x + .5,
            plane.pos.y + .5,
            plane.pos.z + .5,
        ).expand(width/2, height/2, depth/2)
        .translate(width/2, 0, 0);
        if(plane.translate) {
            aabb.translate(plane.translate.x/TX_SIZE, plane.translate.y/TX_SIZE, plane.translate.z/TX_SIZE);
        }

        // Matrix
        let matrix = mat4$5.create();
        if(plane.rot && !isNaN(plane.rot[0])) {
            mat4$5.rotateY(matrix, matrix, plane.rot[1]);
        }
        if(plane.matrix) {
            matrix = mat4$5.multiply(matrix, matrix, plane.matrix);
        }

        //
        const orig_tex = plane.texture;

        // UV
        const uv = [orig_tex[0], orig_tex[1]];
        const add_uv = [
            -.5 + plane.uv[0]/TX_SIZE,
            -.5 + plane.uv[1]/TX_SIZE
        ];
        uv[0] += add_uv[0];
        uv[1] += add_uv[1];

        // Texture
        const tex = [...orig_tex];
        tex[0] += (add_uv[0] / TX_CNT);
        tex[1] += (add_uv[1] / TX_CNT);

        const faces = {
            west: new AABBSideParams(tex, plane.flag, plane?.lm?.b || 1, plane.lm, null, true)
        };

        // Push vertices
        pushAABB(vertices, aabb, pivot, matrix, faces, plane.pos);

    }

    //
    static pushAABB(vertices, part) {

        const pivot = null;

        const width = part.size.x / TX_SIZE;
        const height = part.size.y / TX_SIZE;
        const depth = part.size.z / TX_SIZE;

        const aabb = new AABB();
        aabb.set(
            part.pos.x + .5,
            part.pos.y + .5,
            part.pos.z + .5,
            part.pos.x + .5,
            part.pos.y + .5,
            part.pos.z + .5,
        ).expand(width/2, height/2, depth/2);
        if(part.translate) {
            aabb.translate(part.translate.x/TX_SIZE, part.translate.y/TX_SIZE, part.translate.z/TX_SIZE);
        }

        // Matrix
        let matrix = mat4$5.create();
        if(part.rot && !isNaN(part.rot[0])) {
            mat4$5.rotateY(matrix, matrix, part.rot[1]);
        }
        if(part.matrix) {
            matrix = mat4$5.multiply(matrix, matrix, part.matrix);
        }

        //
        const anim = part?.lm?.b || 1;

        // Faces
        const faces = part.faces;
        for(let k in faces) {

            const face = faces[k];
            const orig_tex = face.texture;

            // UV
            const uv = [orig_tex[0], orig_tex[1]];
            const add_uv = [
                -.5 + face.uv[0]/TX_SIZE,
                -.5 + face.uv[1]/TX_SIZE
            ];
            uv[0] += add_uv[0];
            uv[1] += add_uv[1];

            // Texture
            const tex = [...orig_tex];
            tex[0] += (add_uv[0] / TX_CNT);
            tex[1] += (add_uv[1] / TX_CNT);

            if(!('autoUV' in face)) {
                face.autoUV = true;
            }

            faces[k] = new AABBSideParams(tex, face.flag, anim, part.lm, null, face.autoUV);
        }

        // Push vertices
        pushAABB(vertices, aabb, pivot, matrix, faces, part.pos);

    }

}

var _default = /*#__PURE__*/Object.freeze({
	__proto__: null,
	TX_CNT: TX_CNT,
	TX_SIZE: TX_SIZE,
	'default': style$j
});

const WIDTH$2 =  16 / 32;
const HEIGHT$2 = 20 / 32;

const {mat4: mat4$4} = glMatrix$1;

const lm$2 = MULTIPLY.COLOR.WHITE.clone();

// Фонарь
class style$i {

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['cocoa'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block, for_physic) {
        let y = 1 - .85;
        let aabb = new AABB();
        aabb.set(
            0 + .5 - WIDTH$2 / 2,
            y,
            0 + .5 - WIDTH$2 / 2,
            0 + .5 + WIDTH$2 / 2,
            y + HEIGHT$2,
            0 + .5 + WIDTH$2 / 2,
        );
        const a = ((block.rotate.x - 1) / 4) * (2 * Math.PI);
        aabb.translate(.22 * Math.cos(a), 0, .22 * Math.sin(a));
        return [aabb];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK$1.AIR.id) {
            return;
        }

        const c_up_top          = BLOCK$1.calcMaterialTexture(block.material, DIRECTION.UP, null, null, block);
        const stage             = block.extra_data.stage;
        const flag              = QUAD_FLAGS.NO_AO | QUAD_FLAGS.NORMAL_UP;
        const rot               = [0, ((block.rotate.x - 1) / 4) * (2 * Math.PI), 0];
        const pos               = new Vector$1(x, y, z);

        // 1. Chains
        const planes = [];
        planes.push(...[
            {"size": {"x": 0, "y": 4, "z": 4}, "uv": [14, 2], "rot": [0, 0, 0], "translate": {"x": 0, "y": 6, "z": -6}}
        ]);

        let plane_matrix = mat4$4.create();
        mat4$4.rotateY(plane_matrix, plane_matrix, rot[1] + Math.PI/2);

        for(let plane of planes) {
            style$j.pushPlane(vertices, {
                ...plane,
                lm:         lm$2,
                pos:        pos,
                matrix:     plane_matrix,
                flag:       flag,
                texture:    [...c_up_top]
            });
        }

        // 2. Parts
        const parts = [];
        switch(stage) {
            case 0: {
                parts.push({
                    "size": {"x": 4, "y": 5, "z": 4},
                    "translate": {"x": 5, "y": 1.5, "z": 0},
                    "faces": {
                        "down":  {"uv": [2, 2], "flag": flag, "texture": c_up_top},
                        "up":    {"uv": [2, 2], "flag": flag, "texture": c_up_top},
                        "north": {"uv": [13, 6.5], "flag": flag, "texture": c_up_top},
                        "south": {"uv": [13, 6.5], "flag": flag, "texture": c_up_top},
                        "west":  {"uv": [13, 6.5], "flag": flag, "texture": c_up_top},
                        "east":  {"uv": [13, 6.5], "flag": flag, "texture": c_up_top}
                    }
                });
                break;
            }
            case 1: {
                parts.push({
                    "size": {"x": 6, "y": 7, "z": 6},
                    "translate": {"x": 4, "y": .5, "z": 0},
                    "faces": {
                        "down":  {"uv": [3, 3], "flag": flag, "texture": c_up_top},
                        "up":    {"uv": [3, 3], "flag": flag, "texture": c_up_top},
                        "north": {"uv": [12, 7.5], "flag": flag, "texture": c_up_top},
                        "south": {"uv": [12, 7.5], "flag": flag, "texture": c_up_top},
                        "west":  {"uv": [12, 7.5], "flag": flag, "texture": c_up_top},
                        "east":  {"uv": [12, 7.5], "flag": flag, "texture": c_up_top}
                    }
                });
                break;
            }
            case 2: {
                parts.push({
                    "size": {"x": 7, "y": 9, "z": 7},
                    "translate": {"x": 3.5, "y": -.5, "z": 0},
                    "faces": {
                        "down":  {"uv": [3.5, 3.5], "flag": flag, "texture": c_up_top},
                        "up":    {"uv": [3.5, 3.5], "flag": flag, "texture": c_up_top},
                        "north": {"uv": [11, 8.5], "flag": flag, "texture": c_up_top},
                        "south": {"uv": [11, 8.5], "flag": flag, "texture": c_up_top},
                        "west":  {"uv": [11, 8.5], "flag": flag, "texture": c_up_top},
                        "east":  {"uv": [11, 8.5], "flag": flag, "texture": c_up_top}
                    }
                });
                break;
            }
        }

        for(let part of parts) {
            style$j.pushAABB(vertices, {
                ...part,
                lm:         lm$2,
                pos:        pos,
                rot:        rot,
                matrix:     matrix
            });
        }

        return null;

    }

}

var cocoa = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': style$i
});

"use strict";

let DIRT_BLOCKS = null;
const pivotObj$2 = {x: 0.5, y: .5, z: 0.5};
const DEFAULT_ROTATE = new Vector$1(0, 1, 0);
const _aabb$1 = new AABB();

// @IMPORTANT!: No change order, because it very important for uvlock blocks
const UP_AXES = [
    [[0, 1, 0], [-1, 0, 0]],
    [[-1, 0, 0], [0, -1, 0]],
    [[0, -1, 0], [1, 0, 0]],
    [[1, 0, 0], [0, 1, 0]],
];

// Used for grass pseudo-random rotation
const randoms$4 = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a$4 = new impl('random_dirt_rotations');
for(let i = 0; i < randoms$4.length; i++) {
    randoms$4[i] = Math.round(a$4.double() * 100);
}

class style$h {

    static getRegInfo() {
        return {
            styles: ['cube', 'default'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block, for_physic) {
        const material = block.material;
        let width = material.width ? material.width : 1;
        let height = material.height ? material.height : 1;
        let depth = material.depth ? material.depth : width;

        // Button
        if(material.is_button) {
            if(block.extra_data.pressed) {
                height /= 2;
            }
        }

        const x = 0;
        let y = 0;
        const z = 0;

        // Высота наслаеваемых блоков хранится в extra_data
        if(material.is_layering) {
            if(block.extra_data) {
                height = block.extra_data?.height || height;
            }
            if(material.layering.slab) {
                if(style$h.isOnCeil(block)) {
                    y += material.layering.height;
                }
            }
        }

        // AABB
        let aabb = new AABB();
        aabb.set(
            x + .5 - width/2,
            y,
            z + .5 - depth/2,
            x + .5 + width/2,
            y + height,
            z + .5 + depth/2
        );

        //
        if(block.getCardinalDirection) {
            let cardinal_direction = block.getCardinalDirection();
            let matrix = CubeSym.matrices[cardinal_direction];
            // on the ceil
            if(block.rotate && block.rotate.y == -1) {
                if(block.material.tags.indexOf('rotate_by_pos_n') >= 0 ) {
                    aabb.translate(0, 1 - aabb.y_max, 0);
                }
            }
            aabb.applyMatrix(matrix, pivotObj$2);
        }

        //
        if(!for_physic) {
            aabb.pad(1/500);
        }

        return [aabb];
    }

    static isOnCeil(block) {
        // на верхней части блока (перевернутая ступенька, слэб)
        return block.extra_data && block.extra_data.point.y >= .5;
    }

    //
    static putIntoPot(vertices, material, pivot, matrix, pos, biome, dirt_color) {
        const width = 8/32;
        const {x, y, z} = pos;
        let aabb = new AABB();
        aabb.set(
            x + .5 - width/2,
            y,
            z + .5 - width/2,
            x + .5 + width/2,
            y + 1 - 6/32,
            z + .5 + width/2
        );
        let c_up = BLOCK$1.calcMaterialTexture(material, DIRECTION.UP);
        let c_down = BLOCK$1.calcMaterialTexture(material, DIRECTION.DOWN);
        let c_side = BLOCK$1.calcMaterialTexture(material, DIRECTION.LEFT);

        let flags = 0;

        // Texture color multiplier
        let lm = MULTIPLY.COLOR.WHITE;
        if(material.tags.indexOf('mask_biome') >= 0) {
            lm = dirt_color || MULTIPLY.COLOR.GRASS;
            flags = QUAD_FLAGS.MASK_BIOME;
        } else if(material.tags.indexOf('mask_color') >= 0) {
            flags = QUAD_FLAGS.MASK_BIOME;
            lm = material.mask_color;
        }

        // Push vertices down
        pushAABB(
            vertices,
            aabb,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c_up, flags, 1, lm, null, true),
                down:   new AABBSideParams(c_down, flags, 1, lm, null, true),
                south:  new AABBSideParams(c_side, flags, 1, lm, null, true),
                north:  new AABBSideParams(c_side, flags, 1, lm, null, true),
                west:   new AABBSideParams(c_side, flags, 1, lm, null, true),
                east:   new AABBSideParams(c_side, flags, 1, lm, null, true),
            },
            pos
        );
        return;
    }

    // Can draw face
    static canDrawFace(block, material, neighbourBlock, drawAllSides) {
        if(!neighbourBlock) {
            return true;
        }
        let resp = drawAllSides || neighbourBlock.material?.transparent;
        if(resp) {
            if(block.id == neighbourBlock.id && material.selflit) {
                resp = false;
            } else {
                if(WATER_BLOCKS_ID.indexOf(block.id) >= 0 && WATER_BLOCKS_ID.indexOf(neighbourBlock.id) >= 0) {
                    return false;
                }
            }
        }
        return resp;
    }

    // calculateBlockSize...
    static calculateBlockSize(block, neighbours) {
        const material  = block.material;
        let width       = material.width ? material.width : 1;
        let height      = material.height ? material.height : 1;
        let depth       = material.depth ? material.depth : width;
        // Ladder
        if(material.style == 'ladder') {
            width = 1;
            height = 1;
            depth = 1;
        }
        // Button
        if(material.is_button) {
            if(block.extra_data.pressed) {
                height /= 2;
            }
        } else if(material.is_fluid) {
            if(neighbours.UP && neighbours.UP.material.is_fluid) {
                height = 1.0;
            } else {
                height = .9;
            }
        }
        // Layering
        if(material.is_layering) {
            if(block.extra_data) {
                height = block.extra_data?.height || height;
            }
        }
        //
        if(!DIRT_BLOCKS) {
            DIRT_BLOCKS = [BLOCK$1.GRASS_DIRT.id, BLOCK$1.DIRT_PATH.id, BLOCK$1.SNOW_DIRT.id, BLOCK$1.PODZOL.id, BLOCK$1.MYCELIUM.id];
        }
        if(DIRT_BLOCKS.indexOf(block.id) >= 0) {
            if(neighbours.UP && neighbours.UP.material && (!neighbours.UP.material.transparent || neighbours.UP.material.is_fluid || (neighbours.UP.id == BLOCK$1.DIRT_PATH.id))) {
                height = 1;
            }
        }
        return {width, height, depth};
    }

    // Pushes the vertices necessary for rendering a specific block into the array.
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix = null, pivot = null, force_tex) {

        const material                  = block.material;

        // Pot
        if(block.hasTag('into_pot')) {
            return style$h.putIntoPot(vertices, material, pivot, matrix, new Vector$1(x, y, z), biome, dirt_color);
        }

        const {width, height, depth}    = style$h.calculateBlockSize(block, neighbours);
        const drawAllSides              = (width != 1 || height != 1) && !material.is_water;
        let flags                       = material.light_power ? QUAD_FLAGS.NO_AO : 0;
        let sideFlags                   = flags;
        let upFlags                     = flags;
        let autoUV                      = true;

        // Jukebox
        if(material.is_jukebox) {
            const disc = block?.extra_data?.disc || null;
            if(disc) {
                worker.postMessage(['play_disc', {
                    ...disc,
                    dt: block.extra_data?.dt,
                    pos: chunk.coord.add(new Vector$1(x, y, z))
                }]);
            }
        }

        //
        let canDrawUP = style$h.canDrawFace(block, material, neighbours.UP, drawAllSides) || height < 1;
        let canDrawDOWN = style$h.canDrawFace(block, material, neighbours.DOWN, drawAllSides);
        let canDrawSOUTH = style$h.canDrawFace(block, material, neighbours.SOUTH, drawAllSides);
        let canDrawNORTH = style$h.canDrawFace(block, material, neighbours.NORTH, drawAllSides);
        let canDrawWEST = style$h.canDrawFace(block, material, neighbours.WEST, drawAllSides);
        let canDrawEAST = style$h.canDrawFace(block, material, neighbours.EAST, drawAllSides);
        if(!canDrawUP && !canDrawDOWN && !canDrawSOUTH && !canDrawNORTH && !canDrawWEST && !canDrawEAST) {
            return;
        }

        // Leaves
        if(material.transparent && material.tags.indexOf('leaves') >= 0) {
            if(neighbours.SOUTH.material.tags.indexOf('leaves') > 0) {
                canDrawSOUTH = false;
            }
            if(neighbours.WEST.material.tags.indexOf('leaves') > 0) {
                canDrawWEST = false;
            }
            if(neighbours.UP.material.tags.indexOf('leaves') > 0) {
                canDrawUP = false;
            }
        }

        // Glass
        if(material.transparent && material.tags.indexOf('glass') >= 0) {
            if(neighbours.SOUTH.material.tags.indexOf('glass') >= 0) canDrawSOUTH = false;
            if(neighbours.NORTH.material.tags.indexOf('glass') >= 0) canDrawNORTH = false;
            if(neighbours.WEST.material.tags.indexOf('glass') >= 0) canDrawWEST = false;
            if(neighbours.EAST.material.tags.indexOf('glass') >= 0) canDrawEAST = false;
            if(neighbours.UP.material.tags.indexOf('glass') >= 0) canDrawUP = false;
            if(neighbours.DOWN.material.tags.indexOf('glass') >= 0) canDrawDOWN = false;
        }

        // Texture color multiplier
        let lm = MULTIPLY.COLOR.WHITE;
        if(block.hasTag('mask_biome')) {
            lm = dirt_color; // MULTIPLY.COLOR.GRASS;
            sideFlags = QUAD_FLAGS.MASK_BIOME;
            upFlags = QUAD_FLAGS.MASK_BIOME;
        }
        if(block.hasTag('mask_color')) {
            lm = material.mask_color;
            sideFlags = QUAD_FLAGS.MASK_BIOME;
            upFlags = QUAD_FLAGS.MASK_BIOME;
        }

        let DIRECTION_UP            = DIRECTION.UP;
        let DIRECTION_DOWN          = DIRECTION.DOWN;
        let DIRECTION_BACK          = DIRECTION.BACK;
        let DIRECTION_RIGHT         = DIRECTION.RIGHT;
        let DIRECTION_FORWARD       = DIRECTION.FORWARD;
        let DIRECTION_LEFT          = DIRECTION.LEFT;

        // Rotate
        const rotate = block.rotate || DEFAULT_ROTATE;
        let cardinal_direction      = block.getCardinalDirection();
        matrix = calcRotateMatrix(material, rotate, cardinal_direction, matrix);

        // Can rotate
        if(material.can_rotate && rotate) {
            DIRECTION_BACK          = CubeSym.dirAdd(CubeSym.inv(cardinal_direction), DIRECTION.BACK);
            DIRECTION_RIGHT         = CubeSym.dirAdd(CubeSym.inv(cardinal_direction), DIRECTION.RIGHT);
            DIRECTION_FORWARD       = CubeSym.dirAdd(CubeSym.inv(cardinal_direction), DIRECTION.FORWARD);
            DIRECTION_LEFT          = CubeSym.dirAdd(CubeSym.inv(cardinal_direction), DIRECTION.LEFT);
            //
            if (
                CubeSym.matrices[cardinal_direction][4] <= 0 ||
                (material.tags.indexOf('rotate_by_pos_n') >= 0 && rotate.y != 0)
            ) {
                // @todo: calculate canDrawUP and neighbours based on rotation
                canDrawUP = true;
                canDrawDOWN = true;
                canDrawSOUTH = true;
                canDrawNORTH = true;
                canDrawWEST = true;
                canDrawEAST = true;
                DIRECTION_BACK = DIRECTION.BACK;
                DIRECTION_RIGHT = DIRECTION.RIGHT;
                DIRECTION_FORWARD = DIRECTION.FORWARD;
                DIRECTION_LEFT = DIRECTION.LEFT;
            }
        }

        // Layering
        if(material.is_layering) {
            if(block.properties.layering.slab) {
                if(style$h.isOnCeil(block)) {
                    y += block.properties.layering.height;
                }
            }
        }

        // Убираем шапку травы с дерна, если над ним есть непрозрачный блок
        if(DIRT_BLOCKS.indexOf(block.id) >= 0) {
            if(neighbours.UP && neighbours.UP.material && (!neighbours.UP.material.transparent || neighbours.UP.material.is_fluid || (neighbours.UP.id == BLOCK$1.DIRT_PATH.id))) {
                DIRECTION_UP        = DIRECTION.DOWN;
                DIRECTION_BACK      = DIRECTION.DOWN;
                DIRECTION_RIGHT     = DIRECTION.DOWN;
                DIRECTION_FORWARD   = DIRECTION.DOWN;
                DIRECTION_LEFT      = DIRECTION.DOWN;
                sideFlags = 0;
                upFlags = 0;
            }
        }

        // Поворот текстуры травы в случайном направлении (для избегания эффекта мозаичности поверхности)
        let axes_up = null;
        if(block.id == BLOCK$1.GRASS_DIRT.id || block.id == BLOCK$1.SAND.id) {
            const rv = randoms$4[(z * CHUNK_SIZE_X + x + y * CHUNK_SIZE_Y) % randoms$4.length] | 0;
            axes_up = UP_AXES[rv % 4];
            autoUV = false;
        }

        // uvlock
        if(!material.uvlock) {
            axes_up = UP_AXES[cardinal_direction];
            autoUV = false;
        }

        // Push vertices
        const sides = {};
        if(canDrawUP) {
            let anim_frames = BLOCK$1.getAnimations(material, 'up');
            let animFlag = anim_frames > 1 ? QUAD_FLAGS.FLAG_ANIMATED : 0;
            let t = force_tex || BLOCK$1.calcMaterialTexture(material, DIRECTION_UP, null, null, block);
            sides.up = new AABBSideParams(t, flags | upFlags | animFlag, anim_frames, lm, axes_up, autoUV);
        }
        if(canDrawDOWN) {
            let anim_frames = BLOCK$1.getAnimations(material, 'down');
            let animFlag = anim_frames > 1 ? QUAD_FLAGS.FLAG_ANIMATED : 0;
            let t = force_tex || BLOCK$1.calcMaterialTexture(material, DIRECTION_DOWN, null, null, block);
            sides.down = new AABBSideParams(t, flags | sideFlags | animFlag, anim_frames, lm, null, true);
        }
        if(canDrawSOUTH) {
            let anim_frames = BLOCK$1.getAnimations(material, 'south');
            let animFlag = anim_frames > 1 ? QUAD_FLAGS.FLAG_ANIMATED : 0;
            let t = force_tex || BLOCK$1.calcMaterialTexture(material, DIRECTION_BACK, width, height, block);
            sides.south = new AABBSideParams(t, flags | sideFlags | animFlag, anim_frames, lm, null, false);
        }
        if(canDrawNORTH) {
            let anim_frames = BLOCK$1.getAnimations(material, 'north');
            let animFlag = anim_frames > 1 ? QUAD_FLAGS.FLAG_ANIMATED : 0;
            let t = force_tex || BLOCK$1.calcMaterialTexture(material, DIRECTION_FORWARD, width, height, block);
            t[2] *= -1;
            t[3] *= -1;
            sides.north = new AABBSideParams(t, flags | sideFlags | animFlag, anim_frames, lm, null, false);
        }
        if(canDrawWEST) {
            let anim_frames = BLOCK$1.getAnimations(material, 'west');
            let animFlag = anim_frames > 1 ? QUAD_FLAGS.FLAG_ANIMATED : 0;
            let t = force_tex || BLOCK$1.calcMaterialTexture(material, DIRECTION_LEFT, width, height, block);
            t[2] *= -1;
            t[3] *= -1;
            sides.west = new AABBSideParams(t,  flags | sideFlags | animFlag, anim_frames, lm, null, false);
        }
        if(canDrawEAST) {
            let anim_frames = BLOCK$1.getAnimations(material, 'east');
            let animFlag = anim_frames > 1 ? QUAD_FLAGS.FLAG_ANIMATED : 0;
            let t = force_tex || BLOCK$1.calcMaterialTexture(material, DIRECTION_RIGHT, width, height, block);
            sides.east = new AABBSideParams(t, flags | sideFlags | animFlag, anim_frames, lm, null, false);
        }

        // AABB
        _aabb$1.set(
            x + .5 - width/2,
            y,
            z + .5 - depth/2,
            x + .5 + width/2,
            y + height,
            z + .5 + depth/2
        );
        pushAABB(vertices, _aabb$1, pivot, matrix, sides, new Vector$1(x, y, z));

    }

}

var cube = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': style$h
});

const Z_FIGHT_ERROR = 1/200;

// Дверь
class style$g {

    static getRegInfo() {
        return {
            styles: ['door'],
            func: this.func
        };
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK$1.AIR.id) {
            return;
        }

        const thickness             = 3/16; // толщина блока

        let DIRECTION_UP            = DIRECTION.UP;
        let DIRECTION_DOWN          = DIRECTION.DOWN;
        let DIRECTION_BACK          = DIRECTION.BACK;
        let DIRECTION_RIGHT         = DIRECTION.RIGHT;
        let DIRECTION_FORWARD       = DIRECTION.FORWARD;
        let DIRECTION_LEFT          = DIRECTION.LEFT;

        if(!block.material.name) {
            console.error('block', JSON.stringify(block), block.id);
            debugger;
        }

        let texture                 = block.material.texture;
        let opened                  = block.extra_data.opened;

        // F R B L
        let cardinal_direction      = CubeSym.dirAdd(block.getCardinalDirection(), CubeSym.ROT_Y2);

        if(opened) {
            cardinal_direction = CubeSym.dirAdd(cardinal_direction, block.extra_data.left ? DIRECTION.RIGHT : DIRECTION.LEFT);
        }

        switch(cardinal_direction) {
            case ROTATE.S: {
                break;
            }
            case ROTATE.W: {
                DIRECTION_BACK      = DIRECTION.LEFT;
                DIRECTION_RIGHT     = DIRECTION.BACK;
                DIRECTION_FORWARD   = DIRECTION.RIGHT;
                DIRECTION_LEFT      = DIRECTION.FORWARD;
                break;
            }
            case ROTATE.N: {
                DIRECTION_BACK      = DIRECTION.FORWARD;
                DIRECTION_RIGHT     = DIRECTION.LEFT;
                DIRECTION_FORWARD   = DIRECTION.BACK;
                DIRECTION_LEFT      = DIRECTION.RIGHT;
                break;
            }
            case ROTATE.E: {
                DIRECTION_BACK      = DIRECTION.RIGHT;
                DIRECTION_RIGHT     = DIRECTION.FORWARD;
                DIRECTION_FORWARD   = DIRECTION.LEFT;
                DIRECTION_LEFT      = DIRECTION.BACK;
                break;
            }
        }

        if(!block.extra_data) {
            block.extra_data = {
                opened: true,
                point: new Vector$1(0, 0, 0),
            };
        }

        let tex_up_down = BLOCK$1.calcTexture(texture, DIRECTION_FORWARD);
        let tex_front  = BLOCK$1.calcTexture(texture, DIRECTION_UP);
        let tex_side = BLOCK$1.calcTexture(texture, DIRECTION_LEFT);
        let x_pos = 0;
        let z_pos = 0;
        let y_pos = 0; // нарисовать в нижней части блока

        tex_side[0] -= (thickness * 2 +  .5/16) / TX_CNT$4;
        tex_side[2] = -thickness / TX_CNT$4;
        tex_up_down[1] -= (thickness * 2 +  .5/16) / TX_CNT$4;
        tex_up_down[3] = thickness / TX_CNT$4;

        x_pos = .5;
        z_pos = thickness/2;

        push_part$4(vertices, cardinal_direction,
            x + .5, y + .5, z + .5,
            x_pos - .5, y_pos - .5, z_pos - .5,
            1, thickness * (1 - Z_FIGHT_ERROR), 1,
            tex_up_down, tex_front, tex_side, block.extra_data.opened, block.extra_data.left);

    }
}

//
function push_part$4(vertices, cardinal_direction, cx, cy, cz, x, y, z, xs, zs, ys, tex_up_down, tex_front, tex_side, opened, left) {

    let lm              = MULTIPLY.COLOR.WHITE; // Texture color multiplier
    let flags           = 0;
    let sideFlags       = 0;
    let upFlags         = 0;

    let top_rotate      = [xs, 0, 0, 0, zs, 0]; // Поворот верхней поверхностной текстуры
    let bottom_rotate   = [xs, 0, 0, 0, -zs, 0];
    let north_rotate    = [xs, 0, 0, 0, 0, -ys];
    let south_rotate    = [xs, 0, 0, 0, 0, ys];
    let west_rotate     = [0, -zs, 0, 0, 0, ys];
    let east_rotate     = [0, zs, 0, 0, 0, ys];

    // opened door flips texture
    // flip it back
    const orient = (left ^ opened) ? 1 : -1;

    // TOP
    pushSym(vertices, cardinal_direction,
        cx, cz, cy,
        x, z, y + ys,
        ...top_rotate,
        tex_up_down[0], tex_up_down[1], orient * tex_up_down[2], tex_up_down[3],
        lm.r, lm.g, lm.b, flags | upFlags);
    // BOTTOM
    pushSym(vertices, cardinal_direction,
        cx, cz, cy,
        x, z, y + Z_FIGHT_ERROR,
        ...bottom_rotate,
        tex_up_down[0], tex_up_down[1], orient * tex_up_down[2], tex_up_down[3],
        lm.r, lm.g, lm.b, flags);
    // SOUTH
    pushSym(vertices, cardinal_direction,
        cx, cz, cy,
        x, z - zs/2, y + ys/2,
        ...south_rotate,
        tex_front[0], tex_front[1], orient * tex_front[2], -tex_front[3],
        lm.r, lm.g, lm.b, flags | sideFlags);
    // NORTH
    pushSym(vertices, cardinal_direction,
        cx, cz, cy,
        x, z + zs/2, y + ys/2,
        ...north_rotate,
        tex_front[0], tex_front[1], orient * tex_front[2], tex_front[3],
        lm.r, lm.g, lm.b, flags | sideFlags);
    // WEST
    pushSym(vertices, cardinal_direction,
        cx, cz, cy,
        x - xs/2 * (1 - Z_FIGHT_ERROR), z, y + ys/2,
        ...west_rotate,
        tex_side[0], tex_side[1], orient * tex_side[2], -tex_side[3],
        lm.r, lm.g, lm.b, flags | sideFlags);
    // EAST
    pushSym(vertices, cardinal_direction,
        cx, cz, cy,
        x + xs/2 * (1 - Z_FIGHT_ERROR), z, y + ys/2,
        ...east_rotate,
        tex_side[0], tex_side[1], orient * tex_side[2], -tex_side[3],
        lm.r, lm.g, lm.b, flags | sideFlags);

}

var door = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': style$g
});

const {mat3: mat3$2, mat4: mat4$3} = glMatrix;

const defaultPivot$1 = [0.5, 0.5, 0.5];
const defaultMatrix$1 = mat3$2.create();

function pushTransformed$1(
    vertices, mat, pivot,
    cx, cz, cy,
    x0, z0, y0,
    ux, uz, uy,
    vx, vz, vy,
    c0, c1, c2, c3,
    r, g, b,
    flags
) {
    pivot = pivot || defaultPivot$1;
    cx += pivot[0];
    cy += pivot[1];
    cz += pivot[2];
    x0 -= pivot[0];
    y0 -= pivot[1];
    z0 -= pivot[2];

    mat = mat || defaultMatrix$1;

    let tx = 0;
    let ty = 0;
    let tz = 0;

    // unroll mat4 matrix to mat3 + tx, ty, tz
    if (mat.length === 16) {
        mat3$2.fromMat4(tempMatrix, mat);

        tx = mat[12];
        ty = mat[14]; // flip
        tz = mat[13]; // flip

        mat = tempMatrix;
    }

    vertices.push(
        cx + x0 * mat[0] + y0 * mat[1] + z0 * mat[2] + tx,
        cz + x0 * mat[6] + y0 * mat[7] + z0 * mat[8] + ty,
        cy + x0 * mat[3] + y0 * mat[4] + z0 * mat[5] + tz,

        ux * mat[0] + uy * mat[1] + uz * mat[2],
        ux * mat[6] + uy * mat[7] + uz * mat[8],
        ux * mat[3] + uy * mat[4] + uz * mat[5],

        vx * mat[0] + vy * mat[1] + vz * mat[2],
        vx * mat[6] + vy * mat[7] + vz * mat[8],
        vx * mat[3] + vy * mat[4] + vz * mat[5],

        c0, c1, c2, c3, r, g, b, flags
    );
}

// World
class FakeCloudWorld {

    constructor() {
        let that = this;
        this.blocks_pushed = 0;
        // clouds
        this.clouds = {
            size: new Vector$1(128, 128, 1),
            blocks: Array(256).fill(null).map(el => Array(256).fill(null)),
            init: function(block_id, tex, tex_x, tex_y, tex_w, tex_h) {
                this.size.set(tex_w + 2, tex_h + 2, 1);
                for(let x = 0; x < tex_w; x++) {
                    for(let y = 0; y < tex_h; y++) {
                        let index = ((y + tex_y) * tex.width + (x + tex_x)) * 4;
                        let is_opaque = tex.imageData.data[index + 3] > 10;
                        if(is_opaque) {
                            this.blocks[x + 1][y + 1] = 1;
                        }
                    }
                }
            }
        };
        // chunkManager
        this.chunkManager = {
            getBlock: function(x, y, z) {
                if(z == 0) {
                    if(x >= 0 && x < that.clouds.size.x) {
                        if(y >= 0 && y < that.clouds.size.y) {
                            let resp = that.clouds.blocks[x][y];
                            if(resp) {
                                return resp;
                            }
                        }
                    }
                }
                return 0;
            }
        };
    }

}

// Экструдированные блоки
class style$f {

    static lm = new Color();

    static getRegInfo() {
        return {
            styles: ['extruder'],
            func: this.func
        };
    }

    static func(block, vertices, chunk, _x, _y, _z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {
        _x *= 2;
        _y *= 2;
        _z *= 2;

        let material = block.material;
        let resource_pack = material.resource_pack;

        let texture_id = 'default';
        if(typeof material.texture == 'object' && 'id' in material.texture) {
            texture_id = material.texture.id;
        }

        if(force_tex && force_tex?.id) {
            texture_id = force_tex.id;
        }

        let tex = resource_pack.textures.get(texture_id);
        // Texture
        const c = BLOCK$1.calcMaterialTexture(material, DIRECTION.FORWARD, null, null, null, force_tex);
        if(!tex) {
            console.error(block.id);
        }

        let world = new FakeCloudWorld();
        let tex_w = Math.round(c[2] * tex.width);
        let tex_h = Math.round(c[3] * tex.height);
        let tex_x = Math.round(c[0] * tex.width) - tex_w/2;
        let tex_y = Math.round(c[1] * tex.height) - tex_h/2;
        world.clouds.init(block.id, tex, tex_x, tex_y, tex_w, tex_h);

        //
        neighbours  = {
            UP: null,
            DOWN: null,
            NORTH: null,
            SOUTH: null,
            WEST: null,
            EAST: null
        };
        //
        let clouds = world.clouds;

        const MUL               = 2; // Масштабирование получившейся фигуры
        const SCALE_FACTOR      = tex_w / MUL; // Сколько кубов умещается в 1-м
        const TEX_WIDTH_HALF    = tex_w / 2 * MUL;
        matrix                  = mat3$2.create();
        let scale               = new Vector$1(1, 1, tex_w / 32).divScalar(SCALE_FACTOR);
        mat4$3.scale(matrix, matrix, scale.toArray());

        // Size of one texture pixel
        const ts = tex.width / tex.tx_cnt;

        force_tex = [
            c[0],
            c[1],
            0,
            0,
        ];

        let lm = MULTIPLY.COLOR.WHITE;
        let z = -0.5 - 0.5 / SCALE_FACTOR;
        let flags = QUAD_FLAGS.NO_AO;

        if(block.hasTag('mask_biome')) {
            lm = dirt_color;
            flags = QUAD_FLAGS.MASK_BIOME;
        } else if(block.hasTag('mask_color')) {
            lm = material.mask_color;
            flags = QUAD_FLAGS.MASK_BIOME;
        }

        let height = 1.0;
        let width = 1.0;
        // back & front, no matrices
        vertices.push(
            _x, -scale.z * 0.5 + _z, _y,
            MUL, 0, 0,
            0, 0, MUL * height,
            c[0], c[1], c[2], -c[3],
            lm.r, lm.g, lm.b, flags);

        vertices.push(
            _x, scale.z * (MUL*0.75) + _z, _y,
            MUL, 0, 0,
            0, 0, -MUL * height,
            c[0], c[1], c[2], c[3],
            lm.r, lm.g, lm.b, flags);

        let uc = 1 / tex.width;
        let vc = 1 / tex.height;

        for(let x = 0; x < clouds.size.x; x++) {
            for(let y = 0; y < clouds.size.y; y++) {
                let block  = world.chunkManager.getBlock(x, y, 0);
                if(!block) {
                    continue;
                }
                neighbours.DOWN = world.chunkManager.getBlock(x, y + 1, 0);
                neighbours.UP = world.chunkManager.getBlock(x, y - 1, 0);
                neighbours.WEST = world.chunkManager.getBlock(x - 1, y, 0);
                neighbours.EAST = world.chunkManager.getBlock(x + 1, y, 0);
                // Position of each texture pixel
                let u = (tex_x + (x-1) + 0.5) / tex.width;
                let v = (tex_y + (y-1) + 0.5) / tex.height;

                // inline cube drawing
                let x1 = _x + 0.5 + (x - TEX_WIDTH_HALF - 0.5) / SCALE_FACTOR;
                let y1 = _y - (y - TEX_WIDTH_HALF - 0.5) / SCALE_FACTOR - 1.5;
                let z1 = _z + z + scale.z / (ts / 16);

                if(!neighbours.UP) {
                    pushTransformed$1(
                        vertices, matrix, undefined,
                        x1, z1, y1,
                        .5, 0.5 * MUL, height,
                        1, 0, 0,
                        0, MUL, 0,
                        u, v, uc, vc,
                        lm.r, lm.g, lm.b, flags
                    );
                }

                // Bottom
                if(!neighbours.DOWN) {
                    pushTransformed$1(
                        vertices, matrix, undefined,
                        x1, z1, y1,
                        0.5, 0.5 * MUL, 0,
                        1, 0, 0,
                        0, -1 * MUL, 0,
                        u, v, uc, vc,
                        lm.r, lm.g, lm.b, flags);
                }

                // West
                if(!neighbours.WEST) {
                    pushTransformed$1(
                        vertices, matrix, undefined,
                        x1, z1, y1,
                        .5 - width / 2, .5 * MUL, height / 2,
                        0, 1 * MUL, 0,
                        0, 0, -height,
                        u, v, uc, vc,
                        lm.r, lm.g, lm.b, flags);
                }

                // East
                if(!neighbours.EAST) {
                    pushTransformed$1(
                        vertices, matrix, undefined,
                        x1, z1, y1,
                        .5 + width / 2, .5 * MUL, height / 2,
                        0, 1 * MUL, 0,
                        0, 0, height,
                        u, v, uc, vc,
                        lm.r, lm.g, lm.b, flags);
                }
            }
        }

    }

}

var extruder = /*#__PURE__*/Object.freeze({
	__proto__: null,
	pushTransformed: pushTransformed$1,
	'default': style$f
});

// Забор
class style$e {

    static getRegInfo() {
        return {
            styles: ['fence'],
            func: this.func
        };
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK$1.AIR.id) {
            return;
        }

        const cardinal_direction = block.getCardinalDirection();

        // Texture color multiplier
        let lm = MULTIPLY.COLOR.WHITE;
        if(block.id == BLOCK$1.GRASS_DIRT.id) {
            lm = dirt_color; // MULTIPLY.COLOR.GRASS;
        }

        let DIRECTION_BACK          = DIRECTION.BACK;
        let DIRECTION_RIGHT         = DIRECTION.RIGHT;
        let DIRECTION_FORWARD       = DIRECTION.FORWARD;
        let DIRECTION_LEFT          = DIRECTION.LEFT;

        if(!block.material.name) {
            console.error('block', JSON.stringify(block), block.id);
            debugger;
        }

        let texture                 = block.material.texture;

        // F R B L
        switch(cardinal_direction) {
            case ROTATE.S: {
                break;
            }
            case ROTATE.W: {
                DIRECTION_BACK      = DIRECTION.LEFT;
                DIRECTION_RIGHT     = DIRECTION.BACK;
                DIRECTION_FORWARD   = DIRECTION.RIGHT;
                DIRECTION_LEFT      = DIRECTION.FORWARD;
                break;
            }
            case ROTATE.N: {
                DIRECTION_BACK      = DIRECTION.FORWARD;
                DIRECTION_RIGHT     = DIRECTION.LEFT;
                DIRECTION_FORWARD   = DIRECTION.BACK;
                DIRECTION_LEFT      = DIRECTION.RIGHT;
                break;
            }
            case ROTATE.E: {
                DIRECTION_BACK      = DIRECTION.RIGHT;
                DIRECTION_RIGHT     = DIRECTION.FORWARD;
                DIRECTION_FORWARD   = DIRECTION.LEFT;
                DIRECTION_LEFT      = DIRECTION.BACK;
                break;
            }
        }

        let tex = BLOCK$1.calcTexture(texture, DIRECTION_FORWARD);
        push_part$3(vertices, tex, x + .5, y, z + .5, 4/16, 4/16, 1);

        // South
        if(BLOCK$1.canFenceConnect(neighbours.SOUTH)) {
            push_part$3(vertices, tex, x + .5, y + 6/16, z + .5 - 5/16, 2/16, 6/16, 2/16,);
            push_part$3(vertices, tex, x + .5, y + 12/16, z + .5 - 5/16, 2/16, 6/16, 2/16);
        }
        // North
        if(BLOCK$1.canFenceConnect(neighbours.NORTH)) {
            push_part$3(vertices, tex, x + .5, y + 6/16, z + .5 + 5/16, 2/16, 6/16, 2/16);
            push_part$3(vertices, tex, x + .5, y + 12/16, z + .5 + 5/16, 2/16, 6/16, 2/16);
        }
        // West
        if(BLOCK$1.canFenceConnect(neighbours.WEST)) {
            push_part$3(vertices, tex, x + .5 - 5/16, y + 6/16, z + .5, 6/16, 2/16, 2/16);
            push_part$3(vertices, tex, x + .5 - 5/16, y + 12/16, z + .5, 6/16, 2/16, 2/16);
        }
        // East
        if(BLOCK$1.canFenceConnect(neighbours.EAST)) {
            push_part$3(vertices, tex, x + .5 + 5/16, y + 6/16, z + .5, 6/16, 2/16, 2/16);
            push_part$3(vertices, tex, x + .5 + 5/16, y + 12/16, z + .5, 6/16, 2/16, 2/16);
        }

    }

}

function push_part$3(vertices, c, x, y, z, xs, zs, h) {
    let lm          = MULTIPLY.COLOR.WHITE;
    let flags       = 0;
    let sideFlags   = 0;
    let upFlags     = 0;
    // TOP
    vertices.push(x, z, y + h,
        xs, 0, 0,
        0, zs, 0,
        c[0], c[1], c[2] * xs, c[3] * zs,
        lm.r, lm.g, lm.b, flags | upFlags);
    // BOTTOM
    vertices.push(x, z, y,
        xs, 0, 0,
        0, -zs, 0,
        c[0], c[1], c[2] * xs, c[3] * zs,
        lm.r, lm.g, lm.b, flags);
    // SOUTH
    vertices.push(x, z - zs/2, y + h/2,
        xs, 0, 0,
        0, 0, h,
        c[0], c[1], c[2]*xs, -c[3]*h,
        lm.r, lm.g, lm.b, flags | sideFlags);
    // NORTH
    vertices.push(x, z + zs/2, y + h/2,
        xs, 0, 0,
        0, 0, -h,
        c[0], c[1], -c[2]*xs, c[3]*h,
        lm.r, lm.g, lm.b, flags | sideFlags);
    // WEST
    vertices.push(x - xs/2, z, y + h/2,
        0, zs, 0,
        0, 0, -h,
        c[0], c[1], -c[2]*zs, c[3]*h,
        lm.r, lm.g, lm.b, flags | sideFlags);
    // EAST
    vertices.push(x + xs/2, z, y + h/2,
        0, zs, 0,
        0, 0, h,
        c[0], c[1], c[2]*zs, -c[3]*h,
        lm.r, lm.g, lm.b, flags | sideFlags);
}

var fence = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': style$e
});

// Лестница
class style$d {

    static getRegInfo() {
        return {
            styles: ['ladder'],
            func: this.func
        };
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix = null, pivot = null, force_tex) {

        if(typeof block == 'undefined') {
            return;
        }

        const cardinal_direction = block.getCardinalDirection();

        let texture     = block.material.texture;
        let bH          = 1.0;
        let width       = block.material.width ? block.material.width : 1;
        let lm          = MULTIPLY.COLOR.WHITE;
        let c           = null;
        let flags       = 0;

        // Texture color multiplier
        if(block.id == BLOCK$1.VINES.id) {
            c = BLOCK$1.calcTexture(texture, DIRECTION.BACK);
            lm = dirt_color;
            flags = QUAD_FLAGS.MASK_BIOME;
        } else {
            c = BLOCK$1.calcTexture(texture, DIRECTION.BACK);
        }

        pushSym(vertices, cardinal_direction,
            x + .5, z + .5, y + .5,
            0, width - .5, bH / 2 - .5,
            1, 0, 0,
            0, 0, -bH,
            c[0], c[1], -c[2], c[3],
            lm.r, lm.g, lm.b,
            flags);
    }

}

var ladder = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': style$d
});

const WIDTH$1 =  12 / 32;
const HEIGHT$1 = 14 / 32;

const WIDTH_INNER$1 = 8/32;
const HEIGHT_INNER$1 = 4/32;

const CONNECT_HEIGHT_ON_CEIL = 6 / 16;

const lm$1 = MULTIPLY.COLOR.WHITE.clone();

// Фонарь
class style$c {

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['lantern'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block, for_physic) {
        let y = 0;
        if(block.rotate.y == -1) {
            y += 1 - HEIGHT$1 - HEIGHT_INNER$1 - CONNECT_HEIGHT_ON_CEIL;
        }
        let aabb = new AABB();
        aabb.set(
            0 + .5 - WIDTH$1 / 2,
            y,
            0 + .5 - WIDTH$1 / 2,
            0 + .5 + WIDTH$1 / 2,
            y + HEIGHT$1,
            0 + .5 + WIDTH$1 / 2,
        );
        let aabb2 = new AABB();
        aabb2.set(
            0 + .5 - WIDTH_INNER$1 / 2,
            y + HEIGHT$1,
            0 + .5 - WIDTH_INNER$1 / 2,
            0 + .5 + WIDTH_INNER$1 / 2,
            y + HEIGHT$1 + HEIGHT_INNER$1,
            0 + .5 + WIDTH_INNER$1 / 2,
        );
        return [aabb, aabb2];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK$1.AIR.id) {
            return;
        }

        const c_up_top          = BLOCK$1.calcMaterialTexture(block.material, DIRECTION.UP);
        const animations_side   = BLOCK$1.getAnimations(block.material, 'side');
        const on_ceil           = block.rotate.y == -1;
        const flag              = QUAD_FLAGS.NO_AO | QUAD_FLAGS.NORMAL_UP | QUAD_FLAGS.FLAG_ANIMATED;

        lm$1.b = animations_side;

        const pos = new Vector$1(x, y, z);

        // 1. Chains
        const planes = [];
        if(on_ceil) {
            planes.push(...[
                {"size": {"x": 0, "y": 2, "z": 3}, "uv": [12.5, 11], "rot": [0, -Math.PI / 4, 0], "translate": {"x": 0, "y": 3, "z": 0}}, // up
                {"size": {"x": 0, "y": 4, "z": 3}, "uv": [12.5, 3], "rot": [0, Math.PI / 4, 0], "translate": {"x": 0, "y": 5, "z": 0}}, // full
                {"size": {"x": 0, "y": 2, "z": 3}, "uv": [12.5, 7], "rot": [0, -Math.PI / 4, 0], "translate": {"x": 0, "y": 7, "z": 0}} // down
            ]);
        } else {
            planes.push(...[
                {"size": {"x": 0, "y": 2, "z": 3}, "uv": [12.5, 11], "rot": [0, Math.PI / 4, 0], "translate": {"x": 0, "y": 2, "z": 0}}, // up
                {"size": {"x": 0, "y": 2, "z": 3}, "uv": [12.5, 11], "rot": [0, -Math.PI / 4, 0], "translate": {"x": 0, "y": 2, "z": 0}}, // up
            ]);
        }
        for(let plane of planes) {
            style$j.pushPlane(vertices, {
                ...plane,
                lm:         lm$1,
                pos:        pos,
                matrix:     matrix,
                flag:       flag,
                texture:    [...c_up_top]
            });
        }

        // 2. Parts
        const parts = [];
        const translate_y = on_ceil ? 1 : 0;
        parts.push(...[
            {
                "size": {"x": 4, "y": 2, "z": 4},
                "translate": {"x": 0, "y": translate_y, "z": 0},
                "faces": {
                    "down":  {"uv": [3, 12], "flag": flag, "texture": c_up_top},
                    "up":    {"uv": [3, 12], "flag": flag, "texture": c_up_top},
                    "north": {"uv": [3, 1], "flag": flag, "texture": c_up_top},
                    "south": {"uv": [3, 1], "flag": flag, "texture": c_up_top},
                    "west":  {"uv": [3, 1], "flag": flag, "texture": c_up_top},
                    "east":  {"uv": [3, 1], "flag": flag, "texture": c_up_top}
                }
            },
            {
                "size": {"x": 6, "y": 7, "z": 6},
                "translate": {"x": 0, "y": -4.5 + translate_y, "z": 0},
                "faces": {
                    "down":  {"uv": [3, 12], "flag": flag, "texture": c_up_top},
                    "up":    {"uv": [3, 12], "flag": flag, "texture": c_up_top},
                    "north": {"uv": [3, 5.5], "flag": flag, "texture": c_up_top},
                    "south": {"uv": [3, 5.5], "flag": flag, "texture": c_up_top},
                    "west":  {"uv": [3, 5.5], "flag": flag, "texture": c_up_top},
                    "east":  {"uv": [3, 5.5], "flag": flag, "texture": c_up_top}
                }
            }
        ]);
        for(let part of parts) {
            style$j.pushAABB(vertices, {
                ...part,
                lm:         lm$1,
                pos:        pos,
                matrix:     matrix
            });
        }

        return null;

    }

}

var lantern = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': style$c
});

// Панель
class style$b {

    static getRegInfo() {
        return {
            styles: ['pane'],
            func: this.func
        };
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK$1.AIR.id) {
            return;
        }

        const cardinal_direction = block.getCardinalDirection();

        // Texture color multiplier
        if(block.id == BLOCK$1.GRASS_DIRT.id) {
            lm = dirt_color; // MULTIPLY.COLOR.GRASS;
        }

        let DIRECTION_BACK          = DIRECTION.BACK;
        let DIRECTION_RIGHT         = DIRECTION.RIGHT;
        let DIRECTION_FORWARD       = DIRECTION.FORWARD;
        let DIRECTION_LEFT          = DIRECTION.LEFT;

        if(!block.material.name) {
            console.error('block', JSON.stringify(block), block.id);
            debugger;
        }

        // F R B L
        switch(cardinal_direction) {
            case ROTATE.S: {
                break;
            }
            case ROTATE.W: {
                DIRECTION_BACK      = DIRECTION.LEFT;
                DIRECTION_RIGHT     = DIRECTION.BACK;
                DIRECTION_FORWARD   = DIRECTION.RIGHT;
                DIRECTION_LEFT      = DIRECTION.FORWARD;
                break;
            }
            case ROTATE.N: {
                DIRECTION_BACK      = DIRECTION.FORWARD;
                DIRECTION_RIGHT     = DIRECTION.LEFT;
                DIRECTION_FORWARD   = DIRECTION.BACK;
                DIRECTION_LEFT      = DIRECTION.RIGHT;
                break;
            }
            case ROTATE.E: {
                DIRECTION_BACK      = DIRECTION.RIGHT;
                DIRECTION_RIGHT     = DIRECTION.FORWARD;
                DIRECTION_FORWARD   = DIRECTION.LEFT;
                DIRECTION_LEFT      = DIRECTION.BACK;
                break;
            }
        }

        let texture         = block.material.texture;
        let w               = 2/16;
        let h               = 0.9998;
        let bottom          = y + 1 - h;
        let connect_u       = 7/16;
        let connect_v       = 2/16;
        let tex             = BLOCK$1.calcTexture(texture, DIRECTION_FORWARD);

        let con_s = BLOCK$1.canPaneConnect(neighbours.SOUTH);
        let con_n = BLOCK$1.canPaneConnect(neighbours.NORTH);
        let con_w = BLOCK$1.canPaneConnect(neighbours.WEST);
        let con_e = BLOCK$1.canPaneConnect(neighbours.EAST);

        let no_draw_center_sides = [];
        if(con_s) no_draw_center_sides.push(ROTATE.S);
        if(con_n) no_draw_center_sides.push(ROTATE.N);
        if(con_w) no_draw_center_sides.push(ROTATE.W);
        if(con_e) no_draw_center_sides.push(ROTATE.E);

        push_part$2(vertices, tex, x + .5, bottom, z + .5, w, w, 1, no_draw_center_sides);

        // South
        if(con_s) {
            let ndcs = [];
            if(neighbours.SOUTH.id == block.id) ndcs.push(ROTATE.S);
            if(neighbours.NORTH.id == block.id) ndcs.push(ROTATE.N);
            push_part$2(vertices, tex, x + .5, bottom, z + connect_u/2, connect_v, connect_u, h, ndcs);
        }
        // North
        if(con_n) {
            let ndcs = [];
            if(neighbours.SOUTH.id == block.id) ndcs.push(ROTATE.S);
            if(neighbours.NORTH.id == block.id) ndcs.push(ROTATE.N);
            push_part$2(vertices, tex, x + .5, bottom, z + 1 - connect_u/2, connect_v, connect_u, h, ndcs);
        }
        // West
        if(con_w) {
            let ndcs = [];
            if(neighbours.WEST.id == block.id) ndcs.push(ROTATE.W);
            if(neighbours.EAST.id == block.id) ndcs.push(ROTATE.E);
            push_part$2(vertices, tex, x + connect_u/2, bottom, z + .5, connect_u, connect_v, h, ndcs);
        }
        // East
        if(con_e) {
            let ndcs = [];
            if(neighbours.WEST.id == block.id) ndcs.push(ROTATE.W);
            if(neighbours.EAST.id == block.id) ndcs.push(ROTATE.E);
            push_part$2(vertices, tex, x + 1 - connect_u/2, bottom, z + .5, connect_u, connect_v, h, ndcs);
        }

    }

}

function push_part$2(vertices, c, x, y, z, xs, zs, h, no_draw_center_sides) {
    let lm          = MULTIPLY.COLOR.WHITE;
    let flags       = 0;
    let sideFlags   = 0;
    let upFlags     = 0;
    // TOP
    vertices.push(x, z, y + h,
        xs, 0, 0,
        0, zs, 0,
        c[0], c[1], c[2] * xs, c[3] * zs,
        lm.r, lm.g, lm.b, flags | upFlags);
    // BOTTOM
    vertices.push(x, z, y,
        xs, 0, 0,
        0, -zs, 0,
        c[0], c[1], c[2] * xs, c[3] * zs,
        lm.r, lm.g, lm.b, flags);
    // SOUTH
    if(!no_draw_center_sides || no_draw_center_sides.indexOf(ROTATE.S) < 0) {
        vertices.push(x, z - zs/2, y + h/2,
            xs, 0, 0,
            0, 0, h,
            c[0], c[1], c[2]*xs, -c[3]*h,
            lm.r, lm.g, lm.b, flags | sideFlags);
    }
    // NORTH
    if(!no_draw_center_sides || no_draw_center_sides.indexOf(ROTATE.N) < 0) {
        vertices.push(x, z + zs/2, y + h/2,
            xs, 0, 0,
            0, 0, -h,
            c[0], c[1], -c[2]*xs, c[3]*h,
            lm.r, lm.g, lm.b, flags | sideFlags);
    }
    // WEST
    if(!no_draw_center_sides || no_draw_center_sides.indexOf(ROTATE.W) < 0) {
        vertices.push(x - xs/2, z, y + h/2,
            0, zs, 0,
            0, 0, -h,
            c[0], c[1], -c[2]*zs, c[3]*h,
            lm.r, lm.g, lm.b, flags | sideFlags);
    }
    // EAST
    if(!no_draw_center_sides || no_draw_center_sides.indexOf(ROTATE.E) < 0) {
        vertices.push(x + xs/2, z, y + h/2,
            0, zs, 0,
            0, 0, h,
            c[0], c[1], c[2]*zs, -c[3]*h,
            lm.r, lm.g, lm.b, flags | sideFlags);
    }
}

var pane = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': style$b
});

/**
 * 
 * @param {*} vertices 
 * @param {*} x Start position X
 * @param {*} y Start position Y
 * @param {*} z Start position Z
 * @param {*} c 
 * @param {*} lm 
 * @param {*} x_dir 
 * @param {*} rot 
 * @param {*} xp 
 * @param {*} yp 
 * @param {*} zp 
 * @param {*} flags 
 * @param {*} sym 
 * @param {*} dx
 * @param {*} dy
 * @param {*} dz
 */
 function pushPlanedGeom (
    vertices,
    x, y, z, 
    c, 
    lm,
    x_dir, rot,
    xp, yp, zp,
    flags,
    sym = 0,
    dx = 0, dy = 0, dz = 0,
    ignore_back_side
) {
    [z, y]   = [y, z];
    [zp, yp] = [yp, zp];
    [dz, dy] = [dy, dz];
    
    xp          = xp ? xp : 1;
    yp          = yp ? yp : 1;
    zp          = zp ? zp : 1;
    flags       = flags || 0;

    x += 0.5 * xp;
    y += 0.5 * yp;
    z += 0.5 * zp;

    // because we have rotation, we should create xp and yp as diagonal
    if (rot) {
        xp /= 1.41;
        yp /= 1.41;
    }

    if (x_dir) {
        if(rot) {
            if(!ignore_back_side) {
                pushSym(vertices, sym,
                    x, y, z,
                    dx, dy, dz,
                    xp, yp, 0,
                    0, 0, -zp,
                    c[0], c[1], c[2], c[3],
                    lm.r, lm.g, lm.b, flags);
            }
            pushSym(vertices, sym,
                x, y, z,
                dx, dy, dz,
                -xp, yp, 0,
                0, 0, -zp,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b, flags);
        } else {
            if(!ignore_back_side) {
                pushSym(vertices, sym,
                    x, y, z,
                    dx, dy, dz,
                    xp, 0, 0,
                    0, 0, -zp,
                    c[0], c[1], c[2], c[3],
                    lm.r, lm.g, lm.b, flags);
            }
            pushSym(vertices, sym,
                x, y, z,
                dx, dy, dz,
                -xp, 0, 0,
                0, 0, -zp,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b, flags);
        }
    } else {
        if(rot) {
            if(!ignore_back_side) {
                pushSym(vertices, sym,
                    x, y, z,
                    dx, dy, dz,
                    -xp, -yp, 0,
                    0, 0, -zp,
                    c[0], c[1], c[2], c[3],
                    lm.r, lm.g, lm.b, flags);
            }
            pushSym(vertices, sym,
                x, y, z,
                dx, dy, dz,
                xp, -yp, 0,
                0, 0, -zp,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b, flags);
        } else {
            if(!ignore_back_side) {
                pushSym(vertices, sym,
                    x, y, z,
                    dx, dy, dz,
                    0, yp, 0,
                    0, 0, -zp,
                    c[0], c[1], c[2], c[3],
                    lm.r, lm.g, lm.b, flags);
            }
            pushSym(vertices, sym,
                x, y, z,
                dx, dy, dz,
                0, -yp, 0,
                0, 0, -zp,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b, flags);
        }
    }

}

function pushPlanedGeomCorrect (
    vertices,
    x, y, z, 
    c, 
    lm,
    x_dir, rot,
    xp, yp, zp,
    flags,
    sym = 0,
    dx = 0, dy = 0, dz = 0
) {
    [z, y]   = [y, z];
    [zp, yp] = [yp, zp];
    [dz, dy] = [dy, dz];
    
    xp          = xp ? xp : 1;
    yp          = yp ? yp : 1;
    zp          = zp ? zp : 1;
    flags       = flags || 0;

    x += 0.5;
    y += 0.5;
    z += 0.5;

    // because we have rotation, we should create xp and yp as diagonal
    if (rot) {
        xp /= 1.41;
        yp /= 1.41;
    }

    if (x_dir) {
        if(rot) {
            pushSym(vertices, sym,
                x, y, z,
                dx, dy, dz,
                xp, yp, 0,
                0, 0, -zp,
                c[0], c[1], c[2], c[3],
                lm.r, lm.g, lm.b, flags);
            pushSym(vertices, sym,
                x, y, z,
                dx, dy, dz,
                -xp, yp, 0,
                0, 0, -zp,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b, flags);
        } else {
            pushSym(vertices, sym,
                x, y, z,
                dx, dy, dz,
                xp, 0, 0,
                0, 0, -zp,
                c[0], c[1], c[2], c[3],
                lm.r, lm.g, lm.b, flags);
            pushSym(vertices, sym,
                x, y, z,
                dx, dy, dz,
                -xp, 0, 0,
                0, 0, -zp,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b, flags);
        }
    } else {
        if(rot) {
            pushSym(vertices, sym,
                x, y, z,
                dx, dy, dz,
                -xp, -yp, 0,
                0, 0, -zp,
                c[0], c[1], c[2], c[3],
                lm.r, lm.g, lm.b, flags);
            pushSym(vertices, sym,
                x, y, z,
                dx, dy, dz,
                xp, -yp, 0,
                0, 0, -zp,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b, flags);
        } else {
            pushSym(vertices, sym,
                x, y, z,
                dx, dy, dz,
                0, yp, 0,
                0, 0, -zp,
                c[0], c[1], c[2], c[3],
                lm.r, lm.g, lm.b, flags);
            pushSym(vertices, sym,
                x, y, z,
                dx, dy, dz,
                0, -yp, 0,
                0, 0, -zp,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b, flags);
        }
    }

}

// push_plane
class style$a {

    static getRegInfo() {
        return {
            styles: ['plane'],
            func: this.func
        };
    }

    static func(vertices, x, y, z, c, lm, x_dir, rot, xp, yp, zp, flags, ignore_back_side) {
        return pushPlanedGeom(
            vertices,
            x, y, z,
            c, lm,
            x_dir, rot,
            xp, yp, zp,
            flags, 0, 0, 0, 0,
            ignore_back_side
        );
    }

}

var plane = /*#__PURE__*/Object.freeze({
	__proto__: null,
	pushPlanedGeom: pushPlanedGeom,
	pushPlanedGeomCorrect: pushPlanedGeomCorrect,
	'default': style$a
});

const {mat4: mat4$2} = glMatrix$1;

const DEFAULT_PLANES = [
    {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, 0.7853975, 0]},
    {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, -0.7853975, 0]}
];

const DEFAULT_AABB_SIZE = new Vector$1(12, 12, 12);

const aabb$2 = new AABB();
const pivotObj$1 = {x: 0.5, y: .5, z: 0.5};

let randoms$3 = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a$3 = new impl('random_plants_position');
for(let i = 0; i < randoms$3.length; i++) {
    randoms$3[i] = a$3.double();
}

//
const _pl = {};
const _vec = new Vector$1(0, 0, 0);

// Растения/Цепи
class style$9 {

    static lm = new Color();

    static getRegInfo() {
        return {
            styles: ['planting'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block, for_physic) {

        const aabb_size = block.material.aabb_size || DEFAULT_AABB_SIZE;
        aabb$2.set(0, 0, 0, 0, 0, 0);
        aabb$2
            .translate(.5 * TX_SIZE, aabb_size.y/2, .5 * TX_SIZE)
            .expand(aabb_size.x/2, aabb_size.y/2, aabb_size.z/2)
            .div(TX_SIZE);

        // Rotate
        if(block.getCardinalDirection) {
            let cardinal_direction = block.getCardinalDirection();
            let matrix = CubeSym.matrices[cardinal_direction];
            // on the ceil
            if(block.rotate && block.rotate.y == -1) {
                if(block.material.tags.indexOf('rotate_by_pos_n') >= 0 ) {
                    aabb$2.translate(0, 1 - aabb$2.y_max, 0);
                }
            }
            aabb$2.applyMatrix(matrix, pivotObj$1);
        }

        return [aabb$2];
    }

    //
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        const material = block.material;
        const cardinal_direction = block.getCardinalDirection();
        const texture = BLOCK$1.calcMaterialTexture(material, DIRECTION.UP, null, null, block);

        let dx = 0, dy = 0, dz = 0;
        let flag = QUAD_FLAGS.NO_AO | QUAD_FLAGS.NORMAL_UP;

        style$9.lm.set(MULTIPLY.COLOR.WHITE);
        style$9.lm.b = BLOCK$1.getAnimations(block.material, 'up');
        if(style$9.lm.b > 1) {
            flag |= QUAD_FLAGS.FLAG_ANIMATED;
        }

        //
        if(material.planting) {
            if(neighbours && neighbours.DOWN) {
                const under_height = neighbours.DOWN.material.height;
                if(under_height && under_height < 1) {
                    if(cardinal_direction == 0 || cardinal_direction == CubeSym.ROT_Y3) {
                        dy -= 1 - under_height;
                    }
                }
            }
        }

        //
        const is_grass = block.id == BLOCK$1.GRASS.id || block.id == BLOCK$1.TALL_GRASS.id || block.id == BLOCK$1.TALL_GRASS_TOP.id;
        if(is_grass) {
            dy -= .15;
        }

        // Matrix
        matrix = calcRotateMatrix(material, block.rotate, cardinal_direction, matrix);
        if(material.planting && !block.hasTag('no_random_pos')) {
            let index = Math.abs(Math.round(x * CHUNK_SIZE_Z + z)) % 256;
            const r = randoms$3[index] * 4/16 - 2/16;
            dx = 0.5 - 0.5 + r;
            dz = 0.5 - 0.5 + r;
            if(is_grass) {
                dy -= .2 * randoms$3[index];
                if(!matrix) {
                    matrix = mat4$2.create();
                }
                mat4$2.rotateY(matrix, matrix, Math.PI*2 * randoms$3[index]);
            }
        }

        // Texture color multiplier
        if(block.hasTag('mask_biome')) {
            style$9.lm.set(dirt_color);
            flag |= QUAD_FLAGS.MASK_BIOME;
        }

        // Planes
        const planes = material.planes || DEFAULT_PLANES;
        for(let i = 0; i < planes.length; i++) {
            const plane = planes[i];
            // fill object
            _pl.size     = plane.size;
            _pl.uv       = plane.uv;
            _pl.rot      = plane.rot;
            _pl.lm       = style$9.lm;
            _pl.pos      = _vec.set(x + dx, y + dy, z + dz);
            _pl.matrix   = matrix;
            _pl.flag     = flag;
            _pl.texture  = texture;
            style$j.pushPlane(vertices, _pl);
        }

    }

}

var planting = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': style$9
});

const {mat4: mat4$1} = glMatrix$1;

const WIDTH =  6 / 16;
const HEIGHT = 6 / 16;

const WIDTH_INNER = 4/16;
const HEIGHT_INNER = 1/16;

let randoms$2 = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a$2 = new impl('random_plants_position');
for(let i = 0; i < randoms$2.length; i++) {
    randoms$2[i] = a$2.double();
}

class FakeBlock$1 {

    constructor(id, extra_data, pos, rotate, pivot, matrix, tags, biome, dirt_color) {
        this.id = id;
        this.extra_data = extra_data;
        this.pos = pos;
        this.rotate = rotate;
        this.tags = tags;
        this.pivot = pivot;
        this.matrix = matrix;
        this.biome = biome;
        this.dirt_color = dirt_color;
    }

    getCardinalDirection() {
        return BLOCK$1.getCardinalDirection(this.rotate);
    }

    hasTag(tag) {
        const mat = this.material;
        if(!mat) {
            return false;
        }
        if(!Array.isArray(mat.tags)) {
            return false;
        }
        return mat.tags.indexOf(tag) >= 0;
    }

    get material() {
        return BLOCK$1.fromId(this.id);
    }

};

// Горшок
class style$8 {

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['pot'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block, for_physic) {
        let aabb = new AABB();
        aabb.set(
            0 + .5 - WIDTH / 2,
            0,
            0 + .5 - WIDTH / 2,
            0 + .5 + WIDTH / 2,
            0 + HEIGHT,
            0 + .5 + WIDTH / 2,
        );
        // aabb.pad(1/32)
        return [aabb];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK$1.AIR.id) {
            return;
        }

        // Textures
        const c_top = BLOCK$1.calcMaterialTexture(block.material, DIRECTION.UP);
        const c_side = BLOCK$1.calcMaterialTexture(block.material, DIRECTION.UP);
        const c_down = BLOCK$1.calcMaterialTexture(block.material, DIRECTION.UP);
        const c_inner_down = BLOCK$1.calcMaterialTexture(block.material, DIRECTION.DOWN);

        c_side[1] += 10/32/32;
        c_down[1] += 10/32/32;

        let aabb = new AABB();
        aabb.set(
            x + .5 - WIDTH / 2,
            y + .6,
            z + .5 - WIDTH / 2,
            x + .5 + WIDTH / 2,
            y + .6 + HEIGHT,
            z + .5 + WIDTH / 2,
        );

        matrix = mat4$1.create();

        // Center
        let aabb_down = new AABB();
        aabb_down.set(
            x + .5 - WIDTH/2,
            y,
            z + .5 - WIDTH/2,
            x + .5 + WIDTH/2,
            y + HEIGHT,
            z + .5 + WIDTH/2,
        );

        // Push vertices down
        pushAABB(
            vertices,
            aabb_down,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c_top, 0, 1, null, null, true), // flag: 0, anim: 1 implicit
                down:   new AABBSideParams(c_down, 0, 1, null, null, true),
                south:  new AABBSideParams(c_side, 0, 1, null, null, true),
                north:  new AABBSideParams(c_side, 0, 1, null, null, true),
                west:   new AABBSideParams(c_side, 0, 1, null, null, true),
                east:   new AABBSideParams(c_side, 0, 1, null, null, true),
            },
            new Vector$1(x, y, z)
        );

        // Inner
        aabb_down.set(
            x + .5 - WIDTH_INNER/2,
            y + HEIGHT - HEIGHT_INNER,
            z + .5 - WIDTH_INNER/2,
            x + .5 + WIDTH_INNER/2,
            y + HEIGHT,
            z + .5 + WIDTH_INNER/2,
        );

        // Push vertices down
        pushAABB(
            vertices,
            aabb_down,
            pivot,
            matrix,
            {
                down:   new AABBSideParams(c_inner_down, 0, 1, null, null, true),
                south:  new AABBSideParams(c_side, 0, 1, null, null, true),
                north:  new AABBSideParams(c_side, 0, 1, null, null, true),
                west:   new AABBSideParams(c_side, 0, 1, null, null, true),
                east:   new AABBSideParams(c_side, 0, 1, null, null, true),
            },
            new Vector$1(x, y, z)
        );

        let flower_block_id = null;
        if(block.extra_data && block.extra_data.item_id) {
            flower_block_id = block.extra_data.item_id;
        }

        if(flower_block_id) {
            const fb = new FakeBlock$1(
                flower_block_id,
                null,
                new Vector$1(x, y + 3/16, z),
                new Vector$1(0, 1, 0),
                pivot,
                matrix,
                ['no_random_pos', 'into_pot'],
                biome,
                dirt_color
            );
            return [fb];
        }

        return null;

    }

}

var pot = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': style$8
});

"use strict";

const {mat3: mat3$1} = glMatrix$1;

const defaultPivot = [0.5, 0.5, 0.5];
const defaultMatrix = mat3$1.create();
const aabb$1 = new AABB();

let randoms$1 = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a$1 = new impl('random_redstone_texture');
for(let i = 0; i < randoms$1.length; i++) {
    randoms$1[i] = Math.round(a$1.double() * 100);
}

function pushTransformed(
    vertices, mat, pivot,
    cx, cz, cy,
    x0, z0, y0,
    ux, uz, uy,
    vx, vz, vy,
    c0, c1, c2, c3,
    r, g, b,
    flags
) {
    pivot = pivot || defaultPivot;
    cx += pivot[0];
    cy += pivot[1];
    cz += pivot[2];
    x0 -= pivot[0];
    y0 -= pivot[1];
    z0 -= pivot[2];

    mat = mat || defaultMatrix,
    vertices.push(
        cx + x0 * mat[0] + y0 * mat[1] + z0 * mat[2],
        cz + x0 * mat[6] + y0 * mat[7] + z0 * mat[8],
        cy + x0 * mat[3] + y0 * mat[4] + z0 * mat[5],

        ux * mat[0] + uy * mat[1] + uz * mat[2],
        ux * mat[6] + uy * mat[7] + uz * mat[8],
        ux * mat[3] + uy * mat[4] + uz * mat[5],

        vx * mat[0] + vy * mat[1] + vz * mat[2],
        vx * mat[6] + vy * mat[7] + vz * mat[8],
        vx * mat[3] + vy * mat[4] + vz * mat[5],

        c0, c1, c2, c3, r, g, b, flags
    );
}

class style$7 {

    static getRegInfo() {
        return {
            styles: ['redstone'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block) {
        let hw = 1 / 2;
        let sign_height = .05;
        aabb$1.set(
            .5-hw, 0, .5-hw,
            .5+hw, sign_height, .5+hw
        );
        return [aabb$1];
    }

    // Pushes the vertices necessary for rendering a specific block into the array.
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, _unknown, matrix = null, pivot = null, force_tex) {

        let index               = Math.abs(Math.round(x * CHUNK_SIZE_Z + z)) % 256;
        const r                 = randoms$1[index];
        const H                 = 1;
        const flags             = QUAD_FLAGS.MASK_BIOME;

        const material          = block.material;
        const redstone_textures = material.redstone.textures;
        const tx_cnt            = material.tx_cnt;

        // Texture color multiplier
        // @todo from extra_data.signal
        const lm                = new Color(20.5 / tx_cnt, 1 / 16 / tx_cnt, 0, 0);
        const posworld          = block.posworld;

        const upper_neighbours_connect = {
            south: BLOCK$1.canRedstoneDustConnect(chunk.chunkManager.getBlock(posworld.x, posworld.y + 1, posworld.z - 1)), // z--
            north: BLOCK$1.canRedstoneDustConnect(chunk.chunkManager.getBlock(posworld.x, posworld.y + 1, posworld.z + 1)), // z++
            west: BLOCK$1.canRedstoneDustConnect(chunk.chunkManager.getBlock(posworld.x - 1, posworld.y + 1, posworld.z)), // x--
            east: BLOCK$1.canRedstoneDustConnect(chunk.chunkManager.getBlock(posworld.x + 1, posworld.y + 1, posworld.z)) // x++
        };

        const neighbours_connect = {
            south: BLOCK$1.canRedstoneDustConnect(neighbours.SOUTH) || upper_neighbours_connect.south,
            north: BLOCK$1.canRedstoneDustConnect(neighbours.NORTH) || upper_neighbours_connect.north,
            west: BLOCK$1.canRedstoneDustConnect(neighbours.WEST) || upper_neighbours_connect.west,
            east: BLOCK$1.canRedstoneDustConnect(neighbours.EAST) || upper_neighbours_connect.east
        };

        let zconnects = 0;
        let xconnects = 0;

        const c_line = BLOCK$1.calcTexture(redstone_textures.line[r % redstone_textures.line.length], DIRECTION.UP, tx_cnt);

        // South z--
        if(neighbours_connect.south) {
            zconnects++;
        }
        // North z++
        if(neighbours_connect.north) {
            zconnects++;
        }
        // West x--
        if(neighbours_connect.west) {
            xconnects++;
        }
        // East x++
        if(neighbours_connect.east) {
            xconnects++;
        }

        let y_plus = 1/100;

        function drawZ(x, y, z) {
            y_plus += 1/500;
            pushTransformed(
                vertices, matrix, pivot,
                x, z, y + y_plus,
                0.5, 0.5, 0,
                1, 0, 0,
                0, 1, 0,
                ...c_line,
                lm.r, lm.g, lm.b, flags);
        }

        function drawSouth(x, y, z) {
            y_plus += 1/500;
            pushTransformed(
                vertices, matrix, pivot,
                x, z - .25, y + y_plus,
                0.5, 0.5, 0,
                1, 0, 0,
                0, .5, 0,
                c_line[0] - .25/16/32, c_line[1], c_line[2], c_line[3]/2,
                lm.r, lm.g, lm.b, flags);
        }

        function drawNorth(x, y, z) {
            y_plus += 1/500;
            pushTransformed(
                vertices, matrix, pivot,
                x, z + .25, y + y_plus,
                0.5, 0.5, 0,
                1, 0, 0,
                0, .5, 0,
                c_line[0] + .25/16/32, c_line[1], c_line[2], c_line[3]/2,
                lm.r, lm.g, lm.b, flags);
        }

        function drawX(x, y, z) {
            y_plus += 1/500;
            let top_vectors = [0, -1, 0, 1, 0, 0];
            pushTransformed(
                vertices, matrix, pivot,
                x, z, y + y_plus,
                .5, .5, 0,
                ...top_vectors,
                ...c_line,
                lm.r, lm.g, lm.b, flags);
        }

        function drawWest(x, y, z) {
            y_plus += 1/500;
            let top_vectors = [0, -1, 0, .5, 0, 0];
            pushTransformed(
                vertices, matrix, pivot,
                x - .25, z, y + y_plus,
                .5, .5, 0,
                ...top_vectors,
                c_line[0] - .25/16/32, c_line[1], c_line[2], c_line[3]/2,
                lm.r, lm.g, lm.b, flags);
        }

        function drawEast(x, y, z) {
            y_plus += 1/500;
            let top_vectors = [0, -1, 0, .5, 0, 0];
            pushTransformed(
                vertices, matrix, pivot,
                x + .25, z, y + y_plus,
                0.5, 0.5, 0,
                ...top_vectors,
                c_line[0] + .25/16/32, c_line[1], c_line[2], c_line[3]/2,
                lm.r, lm.g, lm.b, flags);
        }

        // 1.1
        if(zconnects > 0) {
            if(zconnects == 2) {
                drawZ(x, y, z);
            } else {
                if(neighbours_connect.south) {
                    drawSouth(x, y, z);
                } else if(neighbours_connect.north) {
                    drawNorth(x, y, z);
                }
            }
        }

        // 1.2
        if(xconnects > 0) {
            if(xconnects == 2) {
                drawX(x, y, z);
            } else {
                if(neighbours_connect.west) {
                    drawWest(x, y, z);
                } else if(neighbours_connect.east) {
                    drawEast(x, y, z);
                }
            }
            y_plus += 1/500;
        }

        // 1.3 Center
        const draw_center = !(zconnects == 2 && xconnects == 0 || zconnects == 0 && xconnects == 2);
        if(draw_center) {
            const c_center = BLOCK$1.calcTexture(redstone_textures.dot[r % redstone_textures.dot.length], DIRECTION.UP, tx_cnt);
            pushTransformed(
                vertices, matrix, pivot,
                x, z, y + y_plus,
                0.5, 0.5, 0,
                1, 0, 0,
                0, 1, 0,
                ...c_center,
                lm.r, lm.g, lm.b, flags);
        }

        // 2. Draw connects in upper neighbours
        if(upper_neighbours_connect.south) {
            drawNorth(x, y + 1, z - 1);
        }
        if(upper_neighbours_connect.north) {
            drawSouth(x, y + 1, z + 1);
        }
        if(upper_neighbours_connect.west) {
            drawEast(x - 1, y + 1, z);
        }
        if(upper_neighbours_connect.east) {
            drawWest(x + 1, y + 1, z);
        }

        // 3. Draw vertical to neighbours

        // South
        if(upper_neighbours_connect.south) {
            let animations_south = 1;
            pushTransformed(
                vertices, matrix, pivot,
                x, z + 1/500, y,
                .5, .5 - 1 / 2, H / 2,
                1, 0, 0,
                0, 0, H,
                c_line[0], c_line[1], c_line[2], -c_line[3],
                lm.r, lm.g, animations_south, flags);
        }

        // North
        if(upper_neighbours_connect.north) {
            let animations_north = 1;
            pushTransformed(
                vertices, matrix, pivot,
                x, z - 1/500, y,
                .5, .5 + 1 / 2, H / 2,
                1, 0, 0,
                0, 0, -H,
                c_line[0], c_line[1], -c_line[2], c_line[3],
                lm.r, lm.g, animations_north, flags);
        }

        // West
        if(upper_neighbours_connect.west) {
            let animations_west = 1;
            pushTransformed(
                vertices, matrix, pivot,
                x + 1/500, z, y,
                .5 - 1 / 2, .5, H / 2,
                0, 1, 0,
                0, 0, -H,
                c_line[0], c_line[1], -c_line[2], c_line[3],
                lm.r, lm.g, animations_west, flags);
        }

        // East
        if(upper_neighbours_connect.east) {
            let animations_east = 1;
            pushTransformed(
                vertices, matrix, pivot,
                x - 1/500, z, y,
                .5 + 1 / 2, .5, H / 2,
                0, 1, 0,
                0, 0, H,
                c_line[0], c_line[1], c_line[2], -c_line[3],
                lm.r, lm.g, animations_east, flags);
        }

    }

}

var redstone = /*#__PURE__*/Object.freeze({
	__proto__: null,
	pushTransformed: pushTransformed,
	'default': style$7
});

const {mat4} = glMatrix$1;

const CENTER_WIDTH$1      = 1.9 / 16;
const CONNECT_X$1         = 16 / 16;
const CONNECT_Z$1         = 2 / 16;
const CONNECT_HEIGHT$1    = 8 / 16;
const CONNECT_BOTTOM$1    = 9 / 16;
const BOTTOM_HEIGHT     = .6;

const cubeSymAxis$1 = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0]
];

class FakeBlock {

    constructor(id, extra_data, pos, rotate, pivot, matrix) {
        this.id = id;
        this.extra_data = extra_data;
        this.pos = pos;
        this.rotate = rotate;
        this.pivot = pivot;
        this.matrix = matrix;
    }

    get material() {
        return BLOCK$1.fromId(this.id);
    }

};

// Табличка
class style$6 {

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['sign'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block, for_physic) {

        if(for_physic) {
            return [];
        }

        let x           = 0;
        let y           = 0;
        let z           = 0;
        let aabb        = null;
        const resp      = [];
        const width     = .5;
        const height    = 1;
 
        // Center
        if(block.rotate.y == 0) {
            const mul = 1.01;
            aabb = new AABB();
            aabb.set(
                x + .5 - CONNECT_X$1*mul/2,
                y + .6,
                z + .5 - CONNECT_Z$1*mul/2,
                x + .5 + CONNECT_X$1*mul/2,
                y + .6 + CONNECT_HEIGHT$1*mul,
                z + .5 + CONNECT_Z$1*mul/2,
            );
            const dist = -(.5 - aabb.depth / 2);
            const dir = CubeSym.dirAdd(block.rotate.x, CubeSym.ROT_Y2);
            aabb.rotate(dir, aabb.center);
            aabb.translate(cubeSymAxis$1[dir][0] * dist, -(.2 + aabb.height) / 2, cubeSymAxis$1[dir][1] * dist);
        } else {
            aabb = new AABB();
            aabb.set(
                x + .5 - width/2,
                y,
                z + .5 - width/2,
                x + .5 + width/2,
                y + height,
                z + .5 + width/2,
            );
            resp.push(aabb);
        }

        return [aabb];

    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK$1.AIR.id) {
            return;
        }

        // Texture
        const c = BLOCK$1.calcMaterialTexture(block.material, DIRECTION.UP);

        const draw_bottom = block.rotate.y != 0;

        let aabb = new AABB();
        aabb.set(
            x + .5 - CONNECT_X$1/2,
            y + .6,
            z + .5 - CONNECT_Z$1/2,
            x + .5 + CONNECT_X$1/2,
            y + .6 + CONNECT_HEIGHT$1,
            z + .5 + CONNECT_Z$1/2,
        );

        if(draw_bottom) {
            matrix = mat4.create();
            mat4.rotateY(matrix, matrix, ((block.rotate.x - 2) / 4) * -(2 * Math.PI));
        } else {
            aabb.translate(0, -(.2 + aabb.height) / 2, .5 - aabb.depth / 2);
            matrix = CubeSym.matrices[CubeSym.dirAdd(Math.floor(block.rotate.x), CubeSym.ROT_Y2)];
        }

        // Center
        let aabb_down;
        if(draw_bottom) {
            aabb_down = new AABB();
            aabb_down.set(
                x + .5 - CENTER_WIDTH$1/2,
                y,
                z + .5 - CENTER_WIDTH$1/2,
                x + .5 + CENTER_WIDTH$1/2,
                y + BOTTOM_HEIGHT,
                z + .5 + CENTER_WIDTH$1/2,
            );
        }

        // Push vertices
        pushAABB(
            vertices,
            aabb,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c, 0, 1, null, null, true), // flag: 0, anim: 1 implicit 
                down:   new AABBSideParams(c, 0, 1, null, null, true),
                south:  new AABBSideParams(c, 0, 1, null, null, true),
                north:  new AABBSideParams(c, 0, 1, null, null, true),
                west:   new AABBSideParams(c, 0, 1, null, null, true),
                east:   new AABBSideParams(c, 0, 1, null, null, true),
            },
            new Vector$1(x, y, z)
        );

        if(draw_bottom) {
            // Push vertices down
            const c_down = BLOCK$1.calcMaterialTexture(block.material, DIRECTION.DOWN);
            pushAABB(
                vertices,
                aabb_down,
                pivot,
                matrix,
                {
                    up:     new AABBSideParams(c_down, 0, 1, null, null, true), // flag: 0, anim: 1 implicit 
                    down:   new AABBSideParams(c_down, 0, 1, null, null, true),
                    south:  new AABBSideParams(c_down, 0, 1, null, null, true),
                    north:  new AABBSideParams(c_down, 0, 1, null, null, true),
                    west:   new AABBSideParams(c_down, 0, 1, null, null, true),
                    east:   new AABBSideParams(c_down, 0, 1, null, null, true),
                },
                new Vector$1(x, y, z)
            );
        }

        // Return text block
        if(block.extra_data) {
            let text = block.extra_data?.text;
            if(text) {
                return [new FakeBlock(
                    BLOCK$1.TEXT.id,
                    {
                        ...block.extra_data,
                        aabb: aabb,
                        chars: AlphabetTexture.getStringUVs(text),
                        sign: AlphabetTexture.getStringUVs(
                            block.extra_data.username + ' | ' +
                            new Date(block.extra_data.dt || Date.now()).toISOString().slice(0, 10)
                        )
                    },
                    new Vector$1(x, y, z),
                    block.rotate,
                    pivot,
                    matrix
                )];
            }
        }

        return null;

    }

}

var sign = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': style$6
});

// Табличка
class style$5 {

    static _aabb = new AABB();
    static _aabbc = new AABB();
    static _center = new Vector$1(0, 0, 0);
    static _padding = new Vector$1(0, 0, 0);

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['text'],
            func: this.func
        };
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix = null, pivot = null, force_tex) {

        if(!block.extra_data || !block.extra_data.aabb) {
            return;
        }

        const aabb                  = style$5._aabb;
        const aabbc                 = style$5._aabbc;
        const center                = style$5._center.set(x, y, z);
        aabb.copyFrom(block.extra_data.aabb).pad(.1 / 16);

        const LETTER_W              = (aabb.width / 8) * .7;
        const LETTER_H              = (aabb.height / 4) * .6;
        const LETTER_SPACING_MUL    = .5;
        const PADDING               = style$5._padding.set(LETTER_W / 4, -LETTER_H / 4, 0);
        const char_size             = AlphabetTexture.char_size_norm;

        // Letter position
        let cx                      = 0;
        let cy                      = 0;

        function wrap() {
            cx = 0;
            cy++;
        }

        // Each over all text chars
        for(let char of block.extra_data.chars) {
            if(char.char == "\r") {
                wrap();
                continue;
            }
            // Letter texture
            let c = [
                char.xn + char_size.width / 2,
                char.yn + char_size.height / 2,
                char_size.width,
                char_size.height
            ];
            // Letter position
            aabbc.copyFrom(aabb);
            aabbc.x_min += (cx * LETTER_W) * LETTER_SPACING_MUL;
            aabbc.x_max = aabbc.x_min + LETTER_W;
            aabbc.y_min = aabbc.y_max - (cy+1) * LETTER_H;
            aabbc.y_max = aabbc.y_min + LETTER_H;
            aabbc.translate(PADDING.x, PADDING.y, PADDING.z);
            // Push letter vertices
            pushAABB(
                vertices,
                aabbc,
                pivot,
                matrix,
                {
                    south:  new AABBSideParams(c, 0, 1, null, null, false)
                },
                center
            );
            cx++;
        }

        // Draw signature and date on backside
        const sign = block.extra_data.sign;
        if(sign) {
            cx = 0;
            // cy = 10;
            const SCALE_SIGN = 2;
            const plus_x = aabb.width * .5 - (sign.length * (LETTER_W * (LETTER_SPACING_MUL / SCALE_SIGN))) / 2;
            for(let char of sign) {
                if(char.char == "\r") {
                    wrap();
                    continue;
                }
                // Letter texture
                let c = [
                    char.xn + char_size.width / 2,
                    char.yn + char_size.height / 2,
                    char_size.width,
                    char_size.height
                ];
                // Letter position
                aabbc.copyFrom(aabb);
                aabbc.x_min += (cx * LETTER_W) * (LETTER_SPACING_MUL / SCALE_SIGN);
                aabbc.x_max = aabbc.x_min + LETTER_W / SCALE_SIGN;
                aabbc.y_min = aabb.y_min + LETTER_H / SCALE_SIGN, // aabbc.y_max - (cy+1) * LETTER_H / SCALE_SIGN;
                aabbc.y_max = aabbc.y_min + LETTER_H / SCALE_SIGN; // + LETTER_H / SCALE_SIGN;
                aabbc.translate(PADDING.x + plus_x, 0, PADDING.z);
                // Push letter vertices
                pushAABB(
                    vertices,
                    aabbc,
                    pivot,
                    matrix,
                    {
                        south:  new AABBSideParams(c, 0, 1, null, null, false)
                    },
                    center
                );
                cx++;
            }
        }

        return null;

    }

}

var text = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': style$5
});

// Панель
class style$4 {

    static getRegInfo() {
        return {
            styles: ['thin'],
            func: this.func
        };
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(typeof block == 'undefined') {
            return;
        }

        const cardinal_direction = block.getCardinalDirection();

        let texture     = block.material.texture;
        let bH          = 1.0;
        let lm          = MULTIPLY.COLOR.WHITE;
        let c           = BLOCK$1.calcTexture(texture, DIRECTION.FORWARD);

        switch(cardinal_direction) {
            case ROTATE.N:
            case ROTATE.S: {
                // Front
                let n = NORMALS.FORWARD;
                vertices.push(x + .5, z + .5, y + bH/2,
                    1, 0, 0,
                    0, 0, bH,
                    c[0], c[1], c[2], -c[3],
                    lm.r, lm.g, lm.b, 0);
                break;
            }
            case ROTATE.E:
            case ROTATE.W: {
                // Left
                let n = NORMALS.LEFT;
                vertices.push(x + .5, z + .5, y + bH/2,
                    0, 1, 0,
                    0, 0, -bH,
                    c[0], c[1], -c[2], c[3],
                    lm.r, lm.g, lm.b, 0);
                break;
            }
        }

    }

}

var thin = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': style$4
});

const { mat3 } = glMatrix$1;

const cube_func = style$h.getRegInfo().func;
const tmpMat = mat3.create();
const cubeSymAxis = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0]
];

const rotTorch = Math.PI / 5;
const pivotArr = [0.5, 0, 0.5];
const pivotObj = {x: 0.5, y: 0, z: 0.5};

const aabb = new AABB();

class style$3 {

    static getRegInfo() {
        return {
            styles: ['torch'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    static computeAABB(block) {
        const {
            rotate
        } = block;

        const h = 2 / 16;
        let torch_height = 10/16;
        aabb.set(
            .5-h, 0, .5-h,
            .5+h, torch_height, .5+h
        );

        if (!rotate || rotate.y) {
            return aabb;
        }

        const symRot = CubeSym.matrices[(rotate.x + 1) % 4];
        mat3.fromRotation(tmpMat, rotTorch);
        mat3.multiply(tmpMat, tmpMat, symRot);

        aabb.applyMatrix(tmpMat, pivotObj);
        aabb.translate(
            cubeSymAxis[rotate.x][0] * 0.55,
            0.25,
            cubeSymAxis[rotate.x][1] * 0.55
        );

        aabb.y_min -= Math.sin(rotTorch) * h * 2;
        aabb.y_max += Math.sin(rotTorch) * h * 2;
         
        return [aabb];
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix = null, pivot = null, force_tex) {

        const {
            rotate
        } = block;

        if ((!rotate || rotate.y) && (typeof worker != 'undefined')) {
            worker.postMessage(['add_torch', {
                block_pos: chunk.coord.add(new Vector$1(x, y, z)),
                pos: chunk.coord.add(new Vector$1(x, y, z)),
                type: 'torch'
            }]);
            return cube_func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, false, null, null);
        }

        const symRot = CubeSym.matrices[(rotate.x + 1) % 4];
        mat3.fromRotation(tmpMat, rotTorch);
        mat3.multiply(tmpMat, tmpMat, symRot);

        const torch_pos = chunk.coord.add(new Vector$1(
            x + cubeSymAxis[rotate.x][0] * 0.2,
            y + .1,
            z + cubeSymAxis[rotate.x][1] * 0.2,
        ));

        if(typeof worker != 'undefined') {
            worker.postMessage(['add_torch', {
                block_pos: chunk.coord.add(new Vector$1(x, y, z)),
                pos: torch_pos,
                type: 'torch'
            }]);
        }

        return cube_func(
            block,
            vertices,
            chunk, 
            x + cubeSymAxis[rotate.x][0] * 0.55,
            y + 0.25,
            z + cubeSymAxis[rotate.x][1] * 0.55,
            neighbours,
            biome,
            dirt_color,
            false,
            tmpMat,
            pivotArr
        );
    }
}

var torch = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': style$3
});

// Люк
class style$2 {

    static getRegInfo() {
        return {
            styles: ['trapdoor'],
            func: this.func
        };
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK$1.AIR.id) {
            return;
        }

        // Texture color multiplier
        let lm = MULTIPLY.COLOR.WHITE;
        if(block.id == BLOCK$1.GRASS_DIRT.id) {
            lm = dirt_color; // MULTIPLY.COLOR.GRASS;
        }

        let DIRECTION_UP            = DIRECTION.UP;
        let DIRECTION_DOWN          = DIRECTION.DOWN;
        let DIRECTION_BACK          = DIRECTION.BACK;
        let DIRECTION_RIGHT         = DIRECTION.RIGHT;
        let DIRECTION_FORWARD       = DIRECTION.FORWARD;
        let DIRECTION_LEFT          = DIRECTION.LEFT;

        if(!block.material.name) {
            console.error('block', JSON.stringify(block), block.id);
            debugger;
        }

        let texture                 = block.material.texture;

        // F R B L
        let cardinal_direction    = block.getCardinalDirection();
        switch(cardinal_direction) {
            case ROTATE.S: {
                break;
            }
            case ROTATE.W: {
                DIRECTION_BACK      = DIRECTION.LEFT;
                DIRECTION_RIGHT     = DIRECTION.BACK;
                DIRECTION_FORWARD   = DIRECTION.RIGHT;
                DIRECTION_LEFT      = DIRECTION.FORWARD;
                break;
            }
            case ROTATE.N: {
                DIRECTION_BACK      = DIRECTION.FORWARD;
                DIRECTION_RIGHT     = DIRECTION.LEFT;
                DIRECTION_FORWARD   = DIRECTION.BACK;
                DIRECTION_LEFT      = DIRECTION.RIGHT;
                break;
            }
            case ROTATE.E: {
                DIRECTION_BACK      = DIRECTION.RIGHT;
                DIRECTION_RIGHT     = DIRECTION.FORWARD;
                DIRECTION_FORWARD   = DIRECTION.LEFT;
                DIRECTION_LEFT      = DIRECTION.BACK;
                break;
            }
        }
        if(!block.extra_data) {
            block.extra_data = {
                opened: true,
                point: new Vector$1(0, 0, 0),
            };
        }
        let on_ceil = block.extra_data.point.y >= .5;
        let thickness = 3/16; // толщина блока
        // if (on_ceil) {
        //     on_ceil = false;
        //     cardinal_direction = CubeSym.add(CubeSym.ROT_Z2, cardinal_direction);
        // }
        if(block.extra_data.opened) {
            let tex_up_down = BLOCK$1.calcTexture(texture, DIRECTION_FORWARD);
            let tex_front  = BLOCK$1.calcTexture(texture, DIRECTION_UP);
            let tex_side = BLOCK$1.calcTexture(texture, DIRECTION_LEFT);
            let x_pos = 0;
            let z_pos = 0;
            let y_pos = 0; // нарисовать в нижней части блока
            tex_side[1] -= (thickness * 2 +  .5/16) / TX_CNT$4;
            tex_side[2] -= (1 - thickness) / TX_CNT$4;
            tex_side[3] = thickness / TX_CNT$4;
            let size = new Vector$1(1, thickness, 1);

            tex_up_down[1] = tex_side[1];
            tex_up_down[2] = 1 / TX_CNT$4;
            tex_up_down[3] = thickness / TX_CNT$4;
            //
            tex_side[2] = 1 / TX_CNT$4;
            tex_side[3] = thickness / TX_CNT$4;
            //
            x_pos = .5;
            z_pos = thickness/2;
            size = new Vector$1(1, thickness, 1);
            push_part$1(vertices, cardinal_direction,
                x + .5, y + .5, z + .5,
                x_pos - .5, y_pos - .5, z_pos - .5,
                size.x, size.y, size.z, tex_up_down, tex_front, tex_side, block.extra_data.opened, on_ceil);
        } else {
            let tex_up_down = BLOCK$1.calcTexture(texture, DIRECTION_UP);
            let tex_front  = BLOCK$1.calcTexture(texture, DIRECTION_LEFT);
            let tex_side = BLOCK$1.calcTexture(texture, DIRECTION_FORWARD);
            let y_pos = on_ceil ? 1 - thickness : 0; // нарисовать в верхней части блока
            tex_front[1] -= (thickness * 2 +  .5/16) / TX_CNT$4;
            tex_front[3] = thickness / TX_CNT$4;
            tex_side[1] -= (thickness * 2 +  .5/16) / TX_CNT$4;
            tex_side[3] = thickness / TX_CNT$4;
            push_part$1(vertices, cardinal_direction, x + .5, y + .5, z + .5,
                    0, y_pos - .5, 0, 1, 1, thickness, tex_up_down, tex_front, tex_side, block.extra_data.opened, on_ceil);
        }
    }
}

//
function push_part$1(vertices, cardinal_direction, cx, cy, cz, x, y, z, xs, zs, ys, tex_up_down, tex_front, tex_side, opened, on_ceil) {

    let lm              = MULTIPLY.COLOR.WHITE;
    let flags           = 0;
    let sideFlags       = 0;
    let upFlags         = 0;

    let top_rotate      = [xs, 0, 0, 0, zs, 0]; // Поворот верхней поверхностной текстуры
    let bottom_rotate   = [xs, 0, 0, 0, -zs, 0];
    let north_rotate    = [xs, 0, 0, 0, 0, -ys];
    let south_rotate    = [xs, 0, 0, 0, 0, ys];
    let west_rotate     = [0, -zs, 0, 0, 0, ys];
    let east_rotate     = [0, zs, 0, 0, 0, ys];

    if(opened) {
        if(on_ceil) {
            bottom_rotate = [-xs, 0, 0, 0, zs, 0];
            west_rotate = [0, 0, ys, 0, zs, 0];
            east_rotate = [0, 0, -ys, 0, zs, 0];
        } else {
            top_rotate = [-xs, 0, 0, 0, -zs, 0];
            north_rotate = [-xs, 0, 0, 0, 0, ys];
            south_rotate = [-xs, 0, 0, 0, 0, -ys];
            west_rotate = [0, 0,- ys, 0, -zs, 0];
            east_rotate = [0, 0, ys, 0, -zs, 0];
        }
    } else {
        top_rotate = [-xs, 0, 0, 0, -zs, 0];
    }
    // TOP
    pushSym(vertices, cardinal_direction,
        cx, cz, cy,
        x, z, y + ys,
        ...top_rotate,
        tex_up_down[0], tex_up_down[1], tex_up_down[2], tex_up_down[3],
        lm.r, lm.g, lm.b, flags | upFlags);
    // BOTTOM
    pushSym(vertices, cardinal_direction,
        cx, cz, cy,
        x, z, y,
        ...bottom_rotate,
        tex_up_down[0], tex_up_down[1], tex_up_down[2], tex_up_down[3],
        lm.r, lm.g, lm.b, flags);
    // SOUTH
    pushSym(vertices, cardinal_direction,
        cx, cz, cy,
        x, z - zs/2, y + ys/2,
        ...south_rotate,
        tex_front[0], tex_front[1], tex_front[2], -tex_front[3],
        lm.r, lm.g, lm.b, flags | sideFlags);
    // NORTH
    pushSym(vertices, cardinal_direction,
        cx, cz, cy,
        x, z + zs/2, y + ys/2,
        ...north_rotate,
        tex_front[0], tex_front[1], -tex_front[2], tex_front[3],
        lm.r, lm.g, lm.b, flags | sideFlags);
    // WEST
    pushSym(vertices, cardinal_direction,
        cx, cz, cy,
        x - xs/2, z, y + ys/2,
        ...west_rotate,
        tex_side[0], tex_side[1], tex_side[2], -tex_side[3],
        lm.r, lm.g, lm.b, flags | sideFlags);
    // EAST
    pushSym(vertices, cardinal_direction,
        cx, cz, cy,
        x + xs/2, z, y + ys/2,
        ...east_rotate,
        tex_side[0], tex_side[1], tex_side[2], -tex_side[3],
        lm.r, lm.g, lm.b, flags | sideFlags);
}

var trapdoor = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': style$2
});

const push_plane = style$a.getRegInfo().func;

// Треугольники
class style$1 {

    static getRegInfo() {
        return {
            styles: ['triangle'],
            func: this.func
        };
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        const half          = 0.5 / TX_CNT$4;
        let poses           = [];
        let texture         = block.material.texture;
        let lm              = MULTIPLY.COLOR.WHITE;

        block.transparent   = true;

        // полная текстура
        let c = BLOCK$1.calcTexture(texture, DIRECTION.UP);

        // нижняя половина текстуры
        let c_half_bottom = [
            c[0],
            c[1],// + half/2,
            c[2],
            c[3],// - half,
        ];

        const cardinal_direction = block.getCardinalDirection();
        let on_ceil = block.extra_data && block.extra_data.point.y >= .5; // на верхней части блока (перевернутая ступенька)

        let yt = y + 1;
        let yb = y;
        if(on_ceil) {
            // yt -= .5;
            // yb += .5;
        }

        let n = 0;

        // Нижний слэб

        // South - стенка 1
        push_plane(vertices, x, yb, z - 0.5, c_half_bottom, lm, true, false, null, .5, null);

        // North - стенка 2
        push_plane(vertices, x, yb, z + 0.5, c_half_bottom, lm, true, false, null, .5, null);

        // East - стенка 3
        push_plane(vertices, x + 0.5, yb, z, c_half_bottom, lm, false, false, null, 1, null);

        // West - стенка 4
        vertices.push(x + 1/2, y + 1/2, z + 1/2,
            1, 1, 0,
            0, 0, -1,
            ...c,
            lm.r, lm.g, lm.b, 0);

        c = BLOCK$1.calcTexture(texture, DIRECTION.DOWN);

        // дно
        n = NORMALS.DOWN;
        vertices.push(x + .5, z + .5, yb,
            1, 0, 0,
            0, -1, 0,
            c[0], c[1], c[2], -c[3],
            lm.r, lm.g, lm.b, 0);

        // поверхность нижней ступени
        const bH = 1;

        //
        let checkIfSame = (b) => {
            return b.id > 0 && b.material.tags && b.material.tags.indexOf('triangle') >= 0;
        };
        //
        let compareCD = (b) => {
            return checkIfSame(b) && b.getCardinalDirection() == cardinal_direction;
        };

        // F R B L
        switch(cardinal_direction) {
            case ROTATE.S: {
                poses = [
                    new Vector(0, yt, .5),
                    new Vector(-.5, yt, .5),
                ];
                // удаление лишних
                if(!(checkIfSame(neighbours.WEST) && checkIfSame(neighbours.EAST)) && checkIfSame(neighbours.NORTH)) {
                    if(compareCD(neighbours.WEST)) {
                        poses.shift();
                    } else if(compareCD(neighbours.EAST)) {
                        poses.pop();
                    }
                }
                // добавление недостающих
                if(checkIfSame(neighbours.SOUTH)) {
                    let cd = neighbours.SOUTH.getCardinalDirection();
                    if(cd == ROTATE.W) {
                        poses.push(new Vector(0, yt, 0));
                    } else if(cd == ROTATE.E) {
                        poses.push(new Vector(-.5, yt, 0));
                    }
                }
                break;
            }
            case ROTATE.W: {
                poses = [
                    new Vector(0, yt, 0),
                    new Vector(0, yt, .5),
                ];
                // удаление лишних
                if(!(checkIfSame(neighbours.NORTH) && checkIfSame(neighbours.SOUTH)) && checkIfSame(neighbours.EAST)) {
                    if(compareCD(neighbours.NORTH)) {
                        poses.shift();
                    } else if(compareCD(neighbours.SOUTH)) {
                        poses.pop();
                    }
                }
                // добавление недостающих
                if(checkIfSame(neighbours.WEST)) {
                    let cd = neighbours.WEST.getCardinalDirection();
                    if(cd == ROTATE.S) {
                        poses.push(new Vector(-.5, yt, .5));
                    } else if(cd == ROTATE.N) {
                        poses.push(new Vector(-.5, yt, 0));
                    }
                }
                break;
            }
            case ROTATE.N: {
                poses = [
                    new Vector(0, yt, 0),
                    new Vector(-.5, yt, 0),
                ];
                // удаление лишних
                if(!(checkIfSame(neighbours.WEST) && checkIfSame(neighbours.EAST)) && checkIfSame(neighbours.SOUTH)) {
                    if(compareCD(neighbours.WEST)) {
                        poses.shift();
                    } else if(compareCD(neighbours.EAST)) {
                        poses.pop();
                    }
                }
                // добавление недостающих
                if(checkIfSame(neighbours.NORTH)) {
                    let cd = neighbours.NORTH.getCardinalDirection();
                    if(cd == ROTATE.E) {
                        poses.push(new Vector(-.5, yt, .5));
                    } else if(cd == ROTATE.W || cd == ROTATE.N) {
                        poses.push(new Vector(0, yt, .5));
                    }
                }
                break;
            }
            case ROTATE.E: {
                poses = [
                    new Vector(-.5, yt, 0),
                    new Vector(-.5, yt, .5),
                ];
                // удаление лишних
                if(!(checkIfSame(neighbours.NORTH) && checkIfSame(neighbours.SOUTH)) && checkIfSame(neighbours.WEST)) {
                    if(compareCD(neighbours.NORTH)) {
                        poses.shift();
                    } else if(compareCD(neighbours.SOUTH)) {
                        poses.pop();
                    }
                }
                // добавление недостающих
                if(checkIfSame(neighbours.EAST)) {
                    let cd = neighbours.EAST.getCardinalDirection();
                    if(cd == ROTATE.S) {
                        poses.push(new Vector(0, yt, .5));
                    } else if(cd == ROTATE.N) {
                        poses.push(new Vector(0, yt, 0));
                    }
                }
                break;
            }
        }

    }

}

var triangle = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': style$1
});

const CENTER_WIDTH      = 8 / 16;
const CONNECT_X         = 6 / 16;
const CONNECT_Z         = 8 / 16;
const CONNECT_HEIGHT    = 14 / 16;
const CONNECT_BOTTOM    = 0 / 16;

const fake_neighbour = {
    id: 1,
    properties: {
        transparent: false,
        style: 'wall'
    }
};

// Забор
class style {

    static getRegInfo() {
        return {
            styles: ['wall'],
            func: this.func
        };
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK$1.AIR.id) {
            return;
        }

        // Texture
        const c = BLOCK$1.calcMaterialTexture(block.material, DIRECTION.UP);

        let zconnects = 0;
        let xconnects = 0;


        // South and North
        const ss = BLOCK$1.canWallConnect(neighbours.SOUTH);
        const sn = BLOCK$1.canWallConnect(neighbours.NORTH);
        const czsn = (ss && sn) ? 2 : CONNECT_Z;
        // South
        if(ss) {
            push_part(vertices, c, x + .5, y + CONNECT_BOTTOM, z + czsn/4, CONNECT_X, czsn/2, CONNECT_HEIGHT);
            zconnects++;
        }
        // North
        if(sn) {
            if(!ss) {
                push_part(vertices, c, x + .5, y + CONNECT_BOTTOM, z + 1 - CONNECT_Z/4, CONNECT_X, CONNECT_Z/2, CONNECT_HEIGHT);
            }
            zconnects++;
        }

        // West and East
        const sw = BLOCK$1.canWallConnect(neighbours.WEST);
        const se = BLOCK$1.canWallConnect(neighbours.EAST);
        const czwe = (sw && se) ? 2 : CONNECT_Z;
        // West
        if(sw) {
            push_part(vertices, c, x + czwe/4, y + CONNECT_BOTTOM, z + .5, czwe/2, CONNECT_X, CONNECT_HEIGHT);
            xconnects++;
        }
        // East
        if(se) {
            if(!sw) {
                push_part(vertices, c, x + 1. - CONNECT_Z/4, y + CONNECT_BOTTOM, z + .5, CONNECT_Z/2, CONNECT_X, CONNECT_HEIGHT);
            }
            xconnects++;
        }

        let draw_center = !(zconnects == 2 && xconnects == 0 || zconnects == 0 && xconnects == 2);
        if(!draw_center) {
            draw_center = neighbours.UP && neighbours.UP.id > 0;
        }

        if(draw_center) {
            push_part(vertices, c, x + .5, y, z + .5, CENTER_WIDTH, CENTER_WIDTH, 1);
        }

    }

}

function push_part(vertices, c, x, y, z, xs, zs, h) {
    let lm          = MULTIPLY.COLOR.WHITE;
    let flags       = 0;
    let sideFlags   = 0;
    let upFlags     = 0;
    // TOP
    vertices.push(x, z, y + h,
        xs, 0, 0,
        0, zs, 0,
        c[0], c[1], c[2] * xs, c[3] * zs,
        lm.r, lm.g, lm.b, flags | upFlags);
    // BOTTOM
    vertices.push(x, z, y,
        xs, 0, 0,
        0, -zs, 0,
        c[0], c[1], c[2] * xs, c[3] * zs,
        lm.r, lm.g, lm.b, flags);
    // SOUTH
    vertices.push(x, z - zs/2, y + h/2,
        xs, 0, 0,
        0, 0, h,
        c[0], c[1], c[2]*xs, -c[3]*h,
        lm.r, lm.g, lm.b, flags | sideFlags);
    // NORTH
    vertices.push(x, z + zs/2, y + h/2,
        xs, 0, 0,
        0, 0, -h,
        c[0], c[1], -c[2]*xs, c[3]*h,
        lm.r, lm.g, lm.b, flags | sideFlags);
    // WEST
    vertices.push(x - xs/2, z, y + h/2,
        0, zs, 0,
        0, 0, -h,
        c[0], c[1], -c[2]*zs, c[3]*h,
        lm.r, lm.g, lm.b, flags | sideFlags);
    // EAST
    vertices.push(x + xs/2, z, y + h/2,
        0, zs, 0,
        0, 0, h,
        c[0], c[1], c[2]*zs, -c[3]*h,
        lm.r, lm.g, lm.b, flags | sideFlags);
}

var wall = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': style
});

class Vox_Loader {

    constructor(url, onload) {
        if(url) {
            Vox_Loader.load(url, onload);
        }
    }

    static async load(url, onload) {
        await Helpers.fetchBinary(url)
            .then(buffer => {
                const data = new DataView(buffer);
                const id = data.getUint32(0, true);
                const version = data.getUint32(4, true);
                if (id !== 542658390 || version !== 150) {
                    console.error( 'Not a valid VOX file' );
                    return;
                }
                const DEFAULT_PALETTE = [
                    0x00000000, 0xffffffff, 0xffccffff, 0xff99ffff, 0xff66ffff, 0xff33ffff, 0xff00ffff, 0xffffccff,
                    0xffccccff, 0xff99ccff, 0xff66ccff, 0xff33ccff, 0xff00ccff, 0xffff99ff, 0xffcc99ff, 0xff9999ff,
                    0xff6699ff, 0xff3399ff, 0xff0099ff, 0xffff66ff, 0xffcc66ff, 0xff9966ff, 0xff6666ff, 0xff3366ff,
                    0xff0066ff, 0xffff33ff, 0xffcc33ff, 0xff9933ff, 0xff6633ff, 0xff3333ff, 0xff0033ff, 0xffff00ff,
                    0xffcc00ff, 0xff9900ff, 0xff6600ff, 0xff3300ff, 0xff0000ff, 0xffffffcc, 0xffccffcc, 0xff99ffcc,
                    0xff66ffcc, 0xff33ffcc, 0xff00ffcc, 0xffffcccc, 0xffcccccc, 0xff99cccc, 0xff66cccc, 0xff33cccc,
                    0xff00cccc, 0xffff99cc, 0xffcc99cc, 0xff9999cc, 0xff6699cc, 0xff3399cc, 0xff0099cc, 0xffff66cc,
                    0xffcc66cc, 0xff9966cc, 0xff6666cc, 0xff3366cc, 0xff0066cc, 0xffff33cc, 0xffcc33cc, 0xff9933cc,
                    0xff6633cc, 0xff3333cc, 0xff0033cc, 0xffff00cc, 0xffcc00cc, 0xff9900cc, 0xff6600cc, 0xff3300cc,
                    0xff0000cc, 0xffffff99, 0xffccff99, 0xff99ff99, 0xff66ff99, 0xff33ff99, 0xff00ff99, 0xffffcc99,
                    0xffcccc99, 0xff99cc99, 0xff66cc99, 0xff33cc99, 0xff00cc99, 0xffff9999, 0xffcc9999, 0xff999999,
                    0xff669999, 0xff339999, 0xff009999, 0xffff6699, 0xffcc6699, 0xff996699, 0xff666699, 0xff336699,
                    0xff006699, 0xffff3399, 0xffcc3399, 0xff993399, 0xff663399, 0xff333399, 0xff003399, 0xffff0099,
                    0xffcc0099, 0xff990099, 0xff660099, 0xff330099, 0xff000099, 0xffffff66, 0xffccff66, 0xff99ff66,
                    0xff66ff66, 0xff33ff66, 0xff00ff66, 0xffffcc66, 0xffcccc66, 0xff99cc66, 0xff66cc66, 0xff33cc66,
                    0xff00cc66, 0xffff9966, 0xffcc9966, 0xff999966, 0xff669966, 0xff339966, 0xff009966, 0xffff6666,
                    0xffcc6666, 0xff996666, 0xff666666, 0xff336666, 0xff006666, 0xffff3366, 0xffcc3366, 0xff993366,
                    0xff663366, 0xff333366, 0xff003366, 0xffff0066, 0xffcc0066, 0xff990066, 0xff660066, 0xff330066,
                    0xff000066, 0xffffff33, 0xffccff33, 0xff99ff33, 0xff66ff33, 0xff33ff33, 0xff00ff33, 0xffffcc33,
                    0xffcccc33, 0xff99cc33, 0xff66cc33, 0xff33cc33, 0xff00cc33, 0xffff9933, 0xffcc9933, 0xff999933,
                    0xff669933, 0xff339933, 0xff009933, 0xffff6633, 0xffcc6633, 0xff996633, 0xff666633, 0xff336633,
                    0xff006633, 0xffff3333, 0xffcc3333, 0xff993333, 0xff663333, 0xff333333, 0xff003333, 0xffff0033,
                    0xffcc0033, 0xff990033, 0xff660033, 0xff330033, 0xff000033, 0xffffff00, 0xffccff00, 0xff99ff00,
                    0xff66ff00, 0xff33ff00, 0xff00ff00, 0xffffcc00, 0xffcccc00, 0xff99cc00, 0xff66cc00, 0xff33cc00,
                    0xff00cc00, 0xffff9900, 0xffcc9900, 0xff999900, 0xff669900, 0xff339900, 0xff009900, 0xffff6600,
                    0xffcc6600, 0xff996600, 0xff666600, 0xff336600, 0xff006600, 0xffff3300, 0xffcc3300, 0xff993300,
                    0xff663300, 0xff333300, 0xff003300, 0xffff0000, 0xffcc0000, 0xff990000, 0xff660000, 0xff330000,
                    0xff0000ee, 0xff0000dd, 0xff0000bb, 0xff0000aa, 0xff000088, 0xff000077, 0xff000055, 0xff000044,
                    0xff000022, 0xff000011, 0xff00ee00, 0xff00dd00, 0xff00bb00, 0xff00aa00, 0xff008800, 0xff007700,
                    0xff005500, 0xff004400, 0xff002200, 0xff001100, 0xffee0000, 0xffdd0000, 0xffbb0000, 0xffaa0000,
                    0xff880000, 0xff770000, 0xff550000, 0xff440000, 0xff220000, 0xff110000, 0xffeeeeee, 0xffdddddd,
                    0xffbbbbbb, 0xffaaaaaa, 0xff888888, 0xff777777, 0xff555555, 0xff444444, 0xff222222, 0xff111111
                ];
                let i = 8;
                let chunk;
                const chunks = [];
                while(i < data.byteLength) {
                    let id = '';
                    for(let j = 0; j < 4; j ++) {
                        id += String.fromCharCode(data.getUint8(i ++, true));
                    }
                    const chunkSize = data.getUint32(i, true); i += 4;
                    data.getUint32(i, true); i += 4; // childChunks
                    if(id === 'SIZE') {
                        const x = data.getUint32(i, true); i += 4;
                        const y = data.getUint32(i, true); i += 4;
                        const z = data.getUint32(i, true); i += 4;
                        chunk = {
                            palette: DEFAULT_PALETTE,
                            size: {x: x, y: y, z: z},
                        };
                        chunks.push(chunk);
                        i += chunkSize - (3 * 4);
                    } else if (id === 'XYZI') {
                        const numVoxels = data.getUint32(i, true); i += 4;
                        chunk.data = new Uint8Array(buffer, i, numVoxels * 4);
                        i += numVoxels * 4;
                    } else if ( id === 'RGBA' ) {
                        const palette = [ 0 ];
                        for(let j = 0; j < 256; j ++) {
                            palette[ j + 1 ] = data.getUint32(i, true); i += 4;
                        }
                        chunk.palette = palette;
                    } else {
                        // console.log(id, chunkSize, childChunks);
                        i += chunkSize;
                    }
                }

                onload(chunks);

            });
    }

}

class Vox_Mesh {

    constructor(model, coord, shift, material, rotate) {

        const chunk     = model.chunk;
        const palette   = new Map();
        const size      = this.size = chunk.size;
        const offsety   = this.offsety = size.x;
        const offsetz   = this.offsetz = size.x * size.y;

        this.coord      = coord;
        this.blocks     = new Array(size.x * size.y * size.z);

        // Palette
        if(model.palette) {
            for (var i in model.palette) {
                palette.set(parseInt(i), {id: model.palette[i].id});
            }
        }

        // Construct geometry
        let block = null;
        for (let j = 0; j < chunk.data.length; j += 4) {
            let x           = chunk.data[j + 0];
            let y           = chunk.data[j + 1];
            let z           = chunk.data[j + 2];
            const block_id  = chunk.data[j + 3];
            if(rotate && rotate.y == 1) {
                y = this.size.y - y;
            }
            if(!block || block.id != block_id) {
                block = palette.get(block_id);
                if(!block) {
                    block = BLOCK$1.CONCRETE;
                }
            }
            //
            const index = x + (y * offsety) + (z * offsetz);
            this.blocks[index] = block;
        }

        this.temp_xyz = new Vector$1(0, 0, 0);

    }

    // getBlock
    getBlock(xyz) {
        this.temp_xyz.set(xyz.x - this.coord.x, xyz.y - this.coord.y, xyz.z - this.coord.z);
        const index = this.temp_xyz.x + (this.temp_xyz.z * this.offsety) + (this.temp_xyz.y * this.offsetz);
        if(index < 0 || index >= this.blocks.length) {
            return null;
        }
        return this.blocks[index];
    }

}

const CACTUS_MIN_HEIGHT     = 2;
const CACTUS_MAX_HEIGHT     = 5;
const TREE_MIN_HEIGHT       = 4;
const TREE_MAX_HEIGHT       = 8;
const TREE_FREQUENCY        = 0.015;

const biome_stat = {
    height:     {min: 999999999, max: -99999},
    humidity:   {min: 999999999, max: -99999},
    equator:    {min: 999999999, max: -99999},
};

// 1. Trees
class TREES {

    static init() {
        if(TREES.BIRCH) {
            return false;
        }
        TREES.BIRCH             = {trunk: BLOCK$1.BIRCH_TRUNK.id, leaves: BLOCK$1.BIRCH_LEAVES.id, style: 'wood', height: {min: 4, max: 8}};
        TREES.OAK               = {trunk: BLOCK$1.OAK_TRUNK.id, leaves: BLOCK$1.OAK_LEAVES.id, style: 'wood', height: {min: 4, max: 8}};
        TREES.ACACIA            = {trunk: BLOCK$1.ACACIA_TRUNK.id, leaves: BLOCK$1.ACACIA_LEAVES.id, style: 'acacia', height: {min: 5, max: 12}};
        TREES.SPRUCE            = {trunk: BLOCK$1.SPRUCE_TRUNK.id, leaves: BLOCK$1.SPRUCE_LEAVES.id, style: 'spruce', height: {min: 6, max: 22}};
        TREES.TROPICAL_TREE     = {trunk: BLOCK$1.JUNGLE_TRUNK.id, leaves: BLOCK$1.JUNGLE_LEAVES.id, style: 'tropical_tree', height: {min: 1, max: 22}};
        TREES.RED_MUSHROOM      = {trunk: BLOCK$1.MUSHROOM_STRIPE.id, leaves: BLOCK$1.RED_MUSHROOM_BLOCK.id, style: 'mushroom', height: {min: 5, max: 12}};
        TREES.BROWN_MUSHROOM    = {trunk: BLOCK$1.MUSHROOM_STRIPE.id, leaves: BLOCK$1.RED_MUSHROOM_BLOCK.id, style: 'mushroom', height: {min: 5, max: 12}};
        return true;
    }

}

// 2. Biomes
class  BIOMES {

    static init() {
    
        if(BIOMES.OCEAN) {
            return false;
        }

        TREES.init();

        BIOMES.OCEAN = {
            block:      BLOCK$1.STILL_WATER.id,
            code:       'OCEAN',
            color:      '#017bbb',
            dirt_color: new Color(900 / 1024, 880 / 1024, 0, 0),
            title:      'ОКЕАН',
            max_height: 64,
            dirt_block: [BLOCK$1.SAND.id, BLOCK$1.GRAVEL.id, BLOCK$1.GRASS_DIRT.id, BLOCK$1.CLAY.id],
            no_smooth:  false,
            trees:      {
                frequency: 0,
                list: []
            },
            plants: {
                frequency: 0,
                list: []
            }
        };
        
        BIOMES.RIVER = {
            block:      BLOCK$1.STILL_WATER.id,
            code:       'OCEAN',
            color:      '#017bbb',
            dirt_color: new Color(900 / 1024, 880 / 1024, 0, 0),
            title:      'ОКЕАН',
            max_height: 64,
            dirt_block: [BLOCK$1.SAND.id, BLOCK$1.GRAVEL.id, BLOCK$1.CLAY.id, BLOCK$1.GRASS_DIRT.id],
            no_smooth:  false,
            trees:      {
                frequency: 0,
                list: []
            },
            plants: {
                frequency: 0,
                list: []
            }
        };
        
        BIOMES.BEACH = {
            block: BLOCK$1.SAND.id,
            code:       'BEACH',
            color:      '#ffdc7f',
            dirt_color: new Color(770 / 1024, 990 / 1024, 0, 0),
            title:      'ПЛЯЖ',
            max_height: 64,
            dirt_block: [BLOCK$1.SAND.id],
            no_smooth:  false,
            trees:      {
                frequency: 0,
                list: []
            },
            plants: {
                frequency: .005,
                list: [
                    {percent: 1, block: {id: BLOCK$1.DEAD_BUSH.id}}
                ]
            }
        };
        
        BIOMES.TEMPERATE_DESERT = {
            block:      BLOCK$1.GRAVEL.id,
            code:       'TEMPERATE_DESERT',
            color:      '#f4a460',
            dirt_color: new Color(840 / 1024, 980 / 1024, 0, 0),
            title:      'УМЕРЕННАЯ ПУСТЫНЯ',
            dirt_block: [BLOCK$1.SAND.id],
            max_height: 6,
            no_smooth:  false,
            trees:      {
                frequency: TREE_FREQUENCY / 2,
                list: [
                    {percent: 1, trunk: BLOCK$1.CACTUS.id, leaves: null, style: 'cactus', height: {min: TREE_MIN_HEIGHT, max: CACTUS_MAX_HEIGHT}}
                ]
            },
            plants: {
                frequency: TREE_FREQUENCY / 1,
                list: [
                    {percent: 1, block: {id: BLOCK$1.DEAD_BUSH.id}}
                ]
            }
        };
        
        BIOMES.JUNGLE = {
            block:      BLOCK$1.OAK_PLANK.id,
            code:       'JUNGLE',
            color:      '#4eb41c',
            dirt_color: new Color(800 / 1024, 825 / 1024, 0, 0),
            title:      'ДЖУНГЛИ',
            max_height: 48,
            dirt_block: [BLOCK$1.GRASS_DIRT.id, BLOCK$1.GRASS_DIRT.id, BLOCK$1.DIRT.id],
            no_smooth:  false,
            trees:      {
                frequency: TREE_FREQUENCY * 4,
                list: [
                    {percent: .025, ...TREES.TROPICAL_TREE, height: {min: 16, max: 22}},
                    {percent: .1, ...TREES.TROPICAL_TREE, height: {min: 9, max: 14}},
                    {percent: .4, ...TREES.TROPICAL_TREE, height: {min: 3, max: 8}},
                    {percent: .2, ...TREES.TROPICAL_TREE, height: {min: 1, max: 1}},
                    // bamboo
                    {percent: .1, trunk: BLOCK$1.BAMBOO.id, leaves: null, style: 'bamboo', height: {min: 6, max: 20}}
                ]
            },
            plants: {
                frequency: .8,
                list: [
                    {percent: .6, block: {id: BLOCK$1.OAK_LEAVES.id}},
                    {percent: .37, block: {id: BLOCK$1.GRASS.id}},
                    {percent: .01, block: {id: BLOCK$1.TULIP.id}},
                    {percent: .005, block: {id: BLOCK$1.WATERMELON.id}},
                    {percent: .005, block: {id: BLOCK$1.DANDELION.id}}
                ]
            }
        };
        
        BIOMES.SUBTROPICAL_DESERT = {
            block:      BLOCK$1.OAK_PLANK.id,
            code:       'SUBTROPICAL_DESERT',
            color:      '#c19a6b',
            dirt_color: new Color(845 / 1024, 990 / 1024, 0, 0),
            title:      'СУБТРОПИЧЕСКАЯ ПУСТЫНЯ',
            max_height: 6,
            dirt_block: [BLOCK$1.GRASS_DIRT.id, BLOCK$1.GRASS_DIRT.id, BLOCK$1.DIRT.id, BLOCK$1.PODZOL.id],
            no_smooth:  false,
            trees:      {
                frequency: TREE_FREQUENCY,
                list: [
                    {percent: .9, ...TREES.ACACIA, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT * 1.25}},
                    {percent: .1, ...TREES.ACACIA, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT * 1.5}}
                ]
            },
            plants: {
                frequency: .5,
                list: [
                    {percent: .98, block: {id: BLOCK$1.GRASS.id}},
                    {percent: .01, block: {id: BLOCK$1.TULIP.id}},
                    {percent: .01, block: {id: BLOCK$1.DANDELION.id}}
                ]
            }
        };
        
        BIOMES.SCORCHED = {
            block: BLOCK$1.CONCRETE.id,
            code:       'SCORCHED',
            color:      '#ff5500',
            dirt_color: new Color(770 / 1024, 990 / 1024, 0, 0),
            title:      'ОБОГРЕВАЮЩИЙ',
            max_height: 12,
            dirt_block: [BLOCK$1.SAND.id],
            no_smooth:  false,
            trees:      {
                frequency: TREE_FREQUENCY / 4,
                list: [
                    {percent: 1, trunk: BLOCK$1.CACTUS.id, leaves: null, style: 'cactus', height: {min: CACTUS_MIN_HEIGHT, max: CACTUS_MAX_HEIGHT}}
                ]
            },
            plants: {
                frequency: TREE_FREQUENCY / 1,
                list: [
                    {percent: 1, block: {id: BLOCK$1.DEAD_BUSH.id}}
                ]
            }
        };
        
        BIOMES.BARE = {
            block: BLOCK$1.OAK_TRUNK.id,
            code:       'BARE',
            color:      '#CCCCCC',
            dirt_color: new Color(960 / 1024, 950 / 1024, 0, 0),
            title:      'ПУСТОШЬ',
            max_height: 64,
            dirt_block: [BLOCK$1.CONCRETE.id],
            no_smooth:  false,
            trees:      {},
            plants:     {frequency: 0}
        };
        
        BIOMES.TUNDRA = {
            block: BLOCK$1.SPRUCE_TRUNK.id,
            code:       'TUNDRA',
            color:      '#74883c',
            dirt_color: new Color(980 / 1024, 980 / 1024, 0, 0),
            title:      'ТУНДРА',
            max_height: 48,
            dirt_block: [BLOCK$1.GRASS_DIRT.id, BLOCK$1.PODZOL.id],
            no_smooth:  false,
            trees:      {
                frequency: TREE_FREQUENCY * 1.5,
                list: [
                    {percent: 0.01, trunk: BLOCK$1.OAK_TRUNK.id, leaves: BLOCK$1.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                    {percent: 0.01, ...TREES.SPRUCE, height: {min: 6, max: 24}},
                    {percent: 0.1, trunk: BLOCK$1.MOSS_STONE.id, leaves: null, style: 'tundra_stone', height: {min: 2, max: 2}},
                    {percent: 0.2, trunk: BLOCK$1.LARGE_FERN.id, leaves: BLOCK$1.LARGE_FERN_TOP.id, style: 'stump', height: {min: 1, max: 1}},
                    {percent: 0.681, ...TREES.SPRUCE, height: {min: 6, max: 11}}
                ]
            },
            plants: {
                frequency: .65,
                list: [
                    {percent: .62, block: {id: BLOCK$1.GRASS.id}},
                    {percent: .3, block: {id: BLOCK$1.FERN.id}},
                    {percent: .001, block: {id: BLOCK$1.BROWN_MUSHROOM.id}},
                    {percent: .008, block: {id: BLOCK$1.SWEET_BERRY.id, extra_data: {'stage': 3, 'complete': true}}},
                    {percent: .007, block: {id: BLOCK$1.DEAD_BUSH.id}}
                ]
            }
        };
        
        BIOMES.TAIGA = {
            block: BLOCK$1.OAK_TRUNK.id,
            code:       'TAIGA',
            dirt_color: new Color(1000 / 1024, 990 / 1024, 0, 0),
            color:      '#879b89',
            title:      'ТАЙГА',
            max_height: 12,
            dirt_block: [BLOCK$1.GRASS_DIRT.id],
            no_smooth:  false,
            trees:      {
                frequency: TREE_FREQUENCY,
                list: [
                    {percent: 0.01, trunk: BLOCK$1.OAK_TRUNK.id, leaves: BLOCK$1.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                    {percent: 0.99, ...TREES.SPRUCE, height: {min: 7, max: TREE_MAX_HEIGHT}}
                ]
            },
            plants: {
                frequency: 0,
                list: []
            }
        };
        
        BIOMES.SNOW = {
            block:      BLOCK$1.POWDER_SNOW.id,
            code:       'SNOW',
            color:      '#f5f5ff',
            dirt_color: new Color(1020 / 1024, 990 / 1024, 0, 0),
            title:      'СНЕГ',
            max_height: 35,
            dirt_block: [BLOCK$1.SNOW_DIRT.id],
            no_smooth:  false,
            trees:      {
                frequency: TREE_FREQUENCY,
                list: [
                    {percent: 0.01, trunk: BLOCK$1.OAK_TRUNK.id, leaves: BLOCK$1.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                    {percent: 0.99, ...TREES.SPRUCE, height: {min: 7, max: TREE_MAX_HEIGHT}}
                ]
            },
            plants: {
                frequency: 0,
                list: []
            }
        };
        
        BIOMES.SHRUBLAND = {
            block: BLOCK$1.DIAMOND_ORE.id,
            code:       'SHRUBLAND',
            color:      '#316033',
            dirt_color: new Color(880 / 1024, 870 / 1024, 0, 0),
            title:      'КУСТАРНИКИ',
            dirt_block: [BLOCK$1.GRASS_DIRT.id],
            no_smooth:  false,
            max_height: 8,
            trees:      {frequency: 0},
            plants: {
                frequency: .3,
                list: [
                    {percent: 1, block: {id: BLOCK$1.GRASS.id}}
                ]
            }
        };
        
        BIOMES.GRASSLAND = {
            block:      BLOCK$1.GRASS_DIRT.id,
            code:       'GRASSLAND',
            color:      '#98a136',
            dirt_color: new Color(850 / 1024, 930 / 1024, 0, 0),
            title:      'ТРАВЯНАЯ ЗЕМЛЯ',
            max_height: 18,
            dirt_block: [BLOCK$1.GRASS_DIRT.id],
            no_smooth:  false,
            plants: {
                frequency: .5,
                list: [
                    {percent: .800, block: {id: BLOCK$1.GRASS.id}},
                    {percent: .025, block: {id: BLOCK$1.TULIP.id}},
                    {percent: .025, block: {id: BLOCK$1.FLOWER_ALLIUM.id}},
                    {percent: .025, block: {id: BLOCK$1.FLOWER_BLUE_ORCHID.id}},
                    {percent: .025, block: {id: BLOCK$1.FLOWER_OXEYE_DAISY.id}},
                    {percent: .025, block: {id: BLOCK$1.FLOWER_LILY_OF_THE_VALLEY.id}},
                    {percent: .025, block: {id: BLOCK$1.FLOWER_CORNFLOWER.id}},
                    {percent: .025, block: {id: BLOCK$1.DANDELION.id}},
                    {percent: .015, block: {id: BLOCK$1.PUMPKIN.id}},
                    {percent: .025, trunk: BLOCK$1.FLOWER_LILAC.id, leaves: BLOCK$1.FLOWER_LILAC_TOP.id, style: 'stump', height: {min: 1, max: 1}}
                ]
            },
            trees:      {
                frequency: TREE_FREQUENCY / 10,
                list: [
                    {percent: 0.99, ...TREES.OAK, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}}
                ]
            }
        };
        
        BIOMES.TEMPERATE_DECIDUOUS_FOREST = {
            block: BLOCK$1.GLASS.id,
            code:       'TEMPERATE_DECIDUOUS_FOREST',
            color:      '#228b22',
            dirt_color: new Color(800 / 1024, 880 / 1024, 0, 0),
            title:      'УМЕРЕННЫЙ ЛИСТЫЙ ЛЕС',
            max_height: 48,
            dirt_block: [BLOCK$1.GRASS_DIRT.id],
            no_smooth:  false,
            trees:      {
                frequency: TREE_FREQUENCY,
                list: [
                    {percent: 0.01, trunk: BLOCK$1.OAK_TRUNK.id, leaves: BLOCK$1.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                    {percent: 0.99, ...TREES.BIRCH, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}}
                ]
            },
            plants: {
                frequency: .3,
                list: [
                    {percent: .975, block: {id: BLOCK$1.GRASS.id}},
                    {percent: .025, block: {id: BLOCK$1.RED_MUSHROOM.id}}
                ]
            }
        };
        
        BIOMES.TEMPERATE_RAIN_FOREST = {
            block: BLOCK$1.COBBLESTONE.id,
            code:       'TEMPERATE_RAIN_FOREST',
            color:      '#00755e',
            dirt_color: new Color(900 / 1024, 880 / 1024, 0, 0),
            title:      'УМЕРЕННЫЙ ДОЖДЬ ЛЕС',
            max_height: 15,
            dirt_block: [BLOCK$1.GRASS_DIRT.id],
            no_smooth:  false,
            trees:      {
                frequency: TREE_FREQUENCY * 1.5,
                list: [
                    {percent: 0.01, trunk: BLOCK$1.OAK_TRUNK.id, leaves: BLOCK$1.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                    {percent: 0.99, ...TREES.OAK, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}}
                ]
            },
            plants: {
                frequency: 0,
                list: []
            }
        };
        
        BIOMES.TROPICAL_SEASONAL_FOREST = {
            block:      BLOCK$1.BRICKS.id,
            code:       'TROPICAL_SEASONAL_FOREST',
            color:      '#008456',
            dirt_color: new Color(900 / 1024, 900 / 1024, 0, 0),
            // dirt_color: new Color(900 / 1024, 965 / 1024, 0, 0),
            title:      'ТРОПИЧЕСКИЙ СЕЗОННЫЙ ЛЕС',
            max_height: 32,
            dirt_block: [BLOCK$1.GRASS_DIRT.id],
            no_smooth:  false,
            trees:      {
                frequency: TREE_FREQUENCY / 2,
                list: [
                    {percent: 0.01, trunk: BLOCK$1.OAK_TRUNK.id, leaves: BLOCK$1.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                    {percent: 0.99, ...TREES.OAK, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}}
                ]
            },
            plants: {
                frequency: .35,
                list: [
                    {percent: 1, block: {id: BLOCK$1.GRASS.id}}
                ]
            }
        };
        
        BIOMES.TROPICAL_RAIN_FOREST = {
            block:      BLOCK$1.GLOWSTONE.id,
            code:       'TROPICAL_RAIN_FOREST',
            color:      '#16994f',
            dirt_color: new Color(860 / 1024, 910 / 1024, 0, 0),
            title:      'ГРИБНОЙ',
            max_height: 64,
            dirt_block: [BLOCK$1.GRASS_DIRT.id, BLOCK$1.GRASS_DIRT.id, BLOCK$1.MYCELIUM.id, BLOCK$1.MOSS_BLOCK.id],
            no_smooth:  false,
            trees:      {
                frequency: .0085,
                list: [
                    {percent: 0.01, trunk: BLOCK$1.OAK_TRUNK.id, leaves: BLOCK$1.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                    {percent: 0.69, ...TREES.RED_MUSHROOM, height: {min: 8, max: 12}},
                    {percent: 0.15, ...TREES.BROWN_MUSHROOM, height: {min: 5, max: 8}}
                ]
            },
            plants: {
                frequency: .75,
                list: [
                    {percent: .1, block: {id: BLOCK$1.RED_MUSHROOM.id}},
                    {percent: .1, block: {id: BLOCK$1.BROWN_MUSHROOM.id}},
                    {percent: .7, block: {id: BLOCK$1.GRASS.id}}
                ]
            }
        };
        
        for(let k in BIOMES) {
            const biome = BIOMES[k];
            biome.code = k;
            biome.color_rgba = Color.hexToColor(biome.color);
        }

        return true;

    }

    // Функция определения биома в зависимости от возвышенности, влажности и отдаленности от экватора
    static getBiome(v_height, humidity, equator) {

        let height = v_height + 0.;

        if(height < biome_stat.height.min) biome_stat.height.min = height;
        if(height > biome_stat.height.max) biome_stat.height.max = height;

        if(humidity < biome_stat.humidity.min) biome_stat.humidity.min = humidity;
        if(humidity > biome_stat.humidity.max) biome_stat.humidity.max = humidity;

        if(equator < biome_stat.equator.min) biome_stat.equator.min = equator;
        if(equator > biome_stat.equator.max) biome_stat.equator.max = equator;

        function _(humidity, height, equator) {

            if (height < 0.248) return 'OCEAN';
            if (height < 0.253) return 'BEACH';

            if (height > 0.5 || equator < .6) {
                if (humidity < 0.1) return 'SCORCHED';
                if (humidity < 0.2) return 'BARE';
                if (humidity < 0.4) return 'TUNDRA';
                return 'SNOW';
            }
            if (height > 0.6) {
                if (humidity < 0.33) return 'TEMPERATE_DESERT'; // УМЕРЕННАЯ ПУСТЫНЯ
                if (humidity < 0.66) return 'SHRUBLAND'; // кустарник
                return 'TAIGA';
            }
            if (height > 0.3) {
                if (humidity < 0.16) return 'TEMPERATE_DESERT'; // УМЕРЕННАЯ ПУСТЫНЯ
                if (humidity < 0.50) return 'GRASSLAND';
                if (humidity < 0.83) return 'TEMPERATE_DECIDUOUS_FOREST'; // УМЕРЕННЫЙ ЛИСТЫЙ ЛЕС
                return 'TEMPERATE_RAIN_FOREST'; // УМЕРЕННЫЙ ДОЖДЬ ЛЕС
            }
            if (humidity < 0.24) return 'JUNGLE';
            if (humidity < 0.33) return 'GRASSLAND';
            if (humidity < 0.66) return 'TROPICAL_SEASONAL_FOREST';
            return 'TROPICAL_RAIN_FOREST';
        }

        let b = _(humidity, height, equator);
        return BIOMES[b];

    }

}

/*
 * A speed-improved perlin and simplex noise algorithms for 2D.
 *
 * Based on example code by Stefan Gustavson (stegu@itn.liu.se).
 * Optimisations by Peter Eastman (peastman@drizzle.stanford.edu).
 * Better rank ordering method by Stefan Gustavson in 2012.
 * Converted to Javascript by Joseph Gentle.
 *
 * Version 2012-03-09
 *
 * This code was placed in the public domain by its original author,
 * Stefan Gustavson. You may use it as you see fit, but
 * attribution is appreciated.
 *
 */

  var module$1 = {};

  function Grad(x, y, z) {
    this.x = x; this.y = y; this.z = z;
  }
  
  Grad.prototype.dot2 = function(x, y) {
    return this.x*x + this.y*y;
  };

  Grad.prototype.dot3 = function(x, y, z) {
    return this.x*x + this.y*y + this.z*z;
  };

  var grad3 = [new Grad(1,1,0),new Grad(-1,1,0),new Grad(1,-1,0),new Grad(-1,-1,0),
               new Grad(1,0,1),new Grad(-1,0,1),new Grad(1,0,-1),new Grad(-1,0,-1),
               new Grad(0,1,1),new Grad(0,-1,1),new Grad(0,1,-1),new Grad(0,-1,-1)];

  var p = [151,160,137,91,90,15,
  131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
  190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,
  88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,
  77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,
  102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,
  135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,
  5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,
  223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,
  129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,
  251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,
  49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,
  138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
  // To remove the need for index wrapping, double the permutation table length
  var perm = new Array(512);
  var gradP = new Array(512);

  // This isn't a very good seeding function, but it works ok. It supports 2^16
  // different seed values. Write something better if you need more seeds.
  module$1.seed = function(seed) {
    if(seed > 0 && seed < 1) {
      // Scale the seed out
      seed *= 65536;
    }

    seed = Math.floor(seed);
    if(seed < 256) {
      seed |= seed << 8;
    }

    for(var i = 0; i < 256; i++) {
      var v;
      if (i & 1) {
        v = p[i] ^ (seed & 255);
      } else {
        v = p[i] ^ ((seed>>8) & 255);
      }

      perm[i] = perm[i + 256] = v;
      gradP[i] = gradP[i + 256] = grad3[v % 12];
    }
  };

  module$1.seed(0);

  /*
  for(var i=0; i<256; i++) {
    perm[i] = perm[i + 256] = p[i];
    gradP[i] = gradP[i + 256] = grad3[perm[i] % 12];
  }*/

  // Skewing and unskewing factors for 2, 3, and 4 dimensions
  var F2 = 0.5*(Math.sqrt(3)-1);
  var G2 = (3-Math.sqrt(3))/6;

  var F3 = 1/3;
  var G3 = 1/6;

  // 2D simplex noise
  module$1.simplex2 = function(xin, yin) {
    var n0, n1, n2; // Noise contributions from the three corners
    // Skew the input space to determine which simplex cell we're in
    var s = (xin+yin)*F2; // Hairy factor for 2D
    var i = Math.floor(xin+s);
    var j = Math.floor(yin+s);
    var t = (i+j)*G2;
    var x0 = xin-i+t; // The x,y distances from the cell origin, unskewed.
    var y0 = yin-j+t;
    // For the 2D case, the simplex shape is an equilateral triangle.
    // Determine which simplex we are in.
    var i1, j1; // Offsets for second (middle) corner of simplex in (i,j) coords
    if(x0>y0) { // lower triangle, XY order: (0,0)->(1,0)->(1,1)
      i1=1; j1=0;
    } else {    // upper triangle, YX order: (0,0)->(0,1)->(1,1)
      i1=0; j1=1;
    }
    // A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
    // a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
    // c = (3-sqrt(3))/6
    var x1 = x0 - i1 + G2; // Offsets for middle corner in (x,y) unskewed coords
    var y1 = y0 - j1 + G2;
    var x2 = x0 - 1 + 2 * G2; // Offsets for last corner in (x,y) unskewed coords
    var y2 = y0 - 1 + 2 * G2;
    // Work out the hashed gradient indices of the three simplex corners
    i &= 255;
    j &= 255;
    var gi0 = gradP[i+perm[j]];
    var gi1 = gradP[i+i1+perm[j+j1]];
    var gi2 = gradP[i+1+perm[j+1]];
    // Calculate the contribution from the three corners
    var t0 = 0.5 - x0*x0-y0*y0;
    if(t0<0) {
      n0 = 0;
    } else {
      t0 *= t0;
      n0 = t0 * t0 * gi0.dot2(x0, y0);  // (x,y) of grad3 used for 2D gradient
    }
    var t1 = 0.5 - x1*x1-y1*y1;
    if(t1<0) {
      n1 = 0;
    } else {
      t1 *= t1;
      n1 = t1 * t1 * gi1.dot2(x1, y1);
    }
    var t2 = 0.5 - x2*x2-y2*y2;
    if(t2<0) {
      n2 = 0;
    } else {
      t2 *= t2;
      n2 = t2 * t2 * gi2.dot2(x2, y2);
    }
    // Add contributions from each corner to get the final noise value.
    // The result is scaled to return values in the interval [-1,1].
    return 70 * (n0 + n1 + n2);
  };

  // 3D simplex noise
  module$1.simplex3 = function(xin, yin, zin) {
    var n0, n1, n2, n3; // Noise contributions from the four corners

    // Skew the input space to determine which simplex cell we're in
    var s = (xin+yin+zin)*F3; // Hairy factor for 2D
    var i = Math.floor(xin+s);
    var j = Math.floor(yin+s);
    var k = Math.floor(zin+s);

    var t = (i+j+k)*G3;
    var x0 = xin-i+t; // The x,y distances from the cell origin, unskewed.
    var y0 = yin-j+t;
    var z0 = zin-k+t;

    // For the 3D case, the simplex shape is a slightly irregular tetrahedron.
    // Determine which simplex we are in.
    var i1, j1, k1; // Offsets for second corner of simplex in (i,j,k) coords
    var i2, j2, k2; // Offsets for third corner of simplex in (i,j,k) coords
    if(x0 >= y0) {
      if(y0 >= z0)      { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; }
      else if(x0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; }
      else              { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }
    } else {
      if(y0 < z0)      { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; }
      else if(x0 < z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; }
      else             { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; }
    }
    // A step of (1,0,0) in (i,j,k) means a step of (1-c,-c,-c) in (x,y,z),
    // a step of (0,1,0) in (i,j,k) means a step of (-c,1-c,-c) in (x,y,z), and
    // a step of (0,0,1) in (i,j,k) means a step of (-c,-c,1-c) in (x,y,z), where
    // c = 1/6.
    var x1 = x0 - i1 + G3; // Offsets for second corner
    var y1 = y0 - j1 + G3;
    var z1 = z0 - k1 + G3;

    var x2 = x0 - i2 + 2 * G3; // Offsets for third corner
    var y2 = y0 - j2 + 2 * G3;
    var z2 = z0 - k2 + 2 * G3;

    var x3 = x0 - 1 + 3 * G3; // Offsets for fourth corner
    var y3 = y0 - 1 + 3 * G3;
    var z3 = z0 - 1 + 3 * G3;

    // Work out the hashed gradient indices of the four simplex corners
    i &= 255;
    j &= 255;
    k &= 255;
    var gi0 = gradP[i+   perm[j+   perm[k   ]]];
    var gi1 = gradP[i+i1+perm[j+j1+perm[k+k1]]];
    var gi2 = gradP[i+i2+perm[j+j2+perm[k+k2]]];
    var gi3 = gradP[i+ 1+perm[j+ 1+perm[k+ 1]]];

    // Calculate the contribution from the four corners
    var t0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
    if(t0<0) {
      n0 = 0;
    } else {
      t0 *= t0;
      n0 = t0 * t0 * gi0.dot3(x0, y0, z0);  // (x,y) of grad3 used for 2D gradient
    }
    var t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
    if(t1<0) {
      n1 = 0;
    } else {
      t1 *= t1;
      n1 = t1 * t1 * gi1.dot3(x1, y1, z1);
    }
    var t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
    if(t2<0) {
      n2 = 0;
    } else {
      t2 *= t2;
      n2 = t2 * t2 * gi2.dot3(x2, y2, z2);
    }
    var t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
    if(t3<0) {
      n3 = 0;
    } else {
      t3 *= t3;
      n3 = t3 * t3 * gi3.dot3(x3, y3, z3);
    }
    // Add contributions from each corner to get the final noise value.
    // The result is scaled to return values in the interval [-1,1].
    return 32 * (n0 + n1 + n2 + n3);

  };

  // ##### Perlin noise stuff

  function fade(t) {
    return t*t*t*(t*(t*6-15)+10);
  }

  function lerp(a, b, t) {
    return (1-t)*a + t*b;
  }

  // 2D Perlin Noise
  module$1.perlin2 = function(x, y) {
    // Find unit grid cell containing point
    var X = Math.floor(x), Y = Math.floor(y);
    // Get relative xy coordinates of point within that cell
    x = x - X; y = y - Y;
    // Wrap the integer cells at 255 (smaller integer period can be introduced here)
    X = X & 255; Y = Y & 255;

    // Calculate noise contributions from each of the four corners
    var n00 = gradP[X+perm[Y]].dot2(x, y);
    var n01 = gradP[X+perm[Y+1]].dot2(x, y-1);
    var n10 = gradP[X+1+perm[Y]].dot2(x-1, y);
    var n11 = gradP[X+1+perm[Y+1]].dot2(x-1, y-1);

    // Compute the fade curve value for x
    var u = fade(x);

    // Interpolate the four results
    return lerp(
        lerp(n00, n10, u),
        lerp(n01, n11, u),
       fade(y));
  };

  // 3D Perlin Noise
  module$1.perlin3 = function(x, y, z) {
    // Find unit grid cell containing point
    var X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    // Get relative xyz coordinates of point within that cell
    x = x - X; y = y - Y; z = z - Z;
    // Wrap the integer cells at 255 (smaller integer period can be introduced here)
    X = X & 255; Y = Y & 255; Z = Z & 255;

    // Calculate noise contributions from each of the eight corners
    var n000 = gradP[X+  perm[Y+  perm[Z  ]]].dot3(x,   y,     z);
    var n001 = gradP[X+  perm[Y+  perm[Z+1]]].dot3(x,   y,   z-1);
    var n010 = gradP[X+  perm[Y+1+perm[Z  ]]].dot3(x,   y-1,   z);
    var n011 = gradP[X+  perm[Y+1+perm[Z+1]]].dot3(x,   y-1, z-1);
    var n100 = gradP[X+1+perm[Y+  perm[Z  ]]].dot3(x-1,   y,   z);
    var n101 = gradP[X+1+perm[Y+  perm[Z+1]]].dot3(x-1,   y, z-1);
    var n110 = gradP[X+1+perm[Y+1+perm[Z  ]]].dot3(x-1, y-1,   z);
    var n111 = gradP[X+1+perm[Y+1+perm[Z+1]]].dot3(x-1, y-1, z-1);

    // Compute the fade curve value for x, y, z
    var u = fade(x);
    var v = fade(y);
    var w = fade(z);

    // Interpolate
    return lerp(
        lerp(
          lerp(n000, n100, u),
          lerp(n001, n101, u), w),
        lerp(
          lerp(n010, n110, u),
          lerp(n011, n111, u), w),
       v);
  };

var noise = module$1;

class Default_Terrain_Generator {

    constructor(seed, world_id, options) {
        this.voxel_buildings = [];
        this.setSeed(seed);
        this.world_id       = world_id;
        this.options        = options;
        this.x              = 0;
        this.xyz_temp       = new Vector$1(0, 0, 0);
        this.xyz_temp_find  = new Vector$1(0, 0, 0);
        this.xyz_temp_coord = new Vector$1(0, 0, 0);
        this.temp_block     = {id: 0};
        this.temp_tblock    = null;
        this.maps = {
            delete: function() {},
            destroyAroundPlayers: function() {}
        };
    }

    async setSeed(seed) {
        this.seed = seed;
        noise.seed(this.seed);
        //
        this.fastRandoms = new FastRandom(this.seed, CHUNK_SIZE_X * CHUNK_SIZE_Z);
    }

    generate(chunk) {

        let b = (chunk.addr.x + chunk.addr.z) % 2 == 0 ? BLOCK$1.BEDROCK : BLOCK$1.SAND;

        if(chunk.addr.y == 0) {
            for(let x = 0; x < chunk.size.x; x++) {
                for(let z = 0; z < chunk.size.z; z++) {
                    // BEDROCK
                    for(let y = 0; y < 1; y++) {
                        let block = chunk.tblocks.get(new Vector$1(x, y, z));
                        block.id = b.id;
                    }
                }
            }
        }

        let cell = {biome: {dirt_color: new Color(980 / 1024, 980 / 1024, 0, 0), code: 'Flat'}};
        let cells = Array(chunk.size.x).fill(null).map(el => Array(chunk.size.z).fill(cell));

        return {
            chunk: chunk,
            options: {
                WATER_LINE: 63, // Ватер-линия
            },
            info: {
                cells: cells
            }
        };

    }

    //
    getVoxelBuilding(xyz) {
        for (let i = 0; i < this.voxel_buildings.length; i++) {
            const vb = this.voxel_buildings[i];
            if(xyz.x >= vb.coord.x && xyz.y >= vb.coord.y && xyz.z >= vb.coord.z &&
                xyz.x < vb.coord.x + vb.size.x &&
                xyz.y < vb.coord.y + vb.size.z &&
                xyz.z < vb.coord.z + vb.size.y) {
                    return vb;
                }
        }
        return null;
    }

    // setBlock
    setBlock(chunk, x, y, z, block_type, force_replace, rotate, extra_data) {
        const { tblocks } = chunk;
        if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
            if(force_replace || !tblocks.getBlockId(x, y, z)) {
                this.xyz_temp_coord.set(x, y, z).addSelf(chunk.coord);
                if(!this.getVoxelBuilding(this.xyz_temp_coord)) {
                    tblocks.setBlockId(x, y, z, block_type.id);
                    if(rotate || extra_data) {
                        tblocks.setBlockRotateExtra(x, y, z, rotate, extra_data);
                    }
                }
            }
        }
    }

    getBlock(chunk, x, y, z) {
        if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
            let xyz = new Vector$1(x, y, z);
            return chunk.tblocks.get(xyz);
        }
    }

    // plantTree...
    plantTree(options, chunk, x, y, z, check_chunk_size) {
        const type = options.type;
        // листва над стволом
        switch(type.style) {
            // кактус
            case 'cactus': {
                this.plantCactus(options, chunk, x, y, z);
                break;
            }
            // бамбук
            case 'bamboo': {
                this.plantBamboo(options, chunk, x, y, z);
                break;
            }
            // пенёк
            case 'stump': {
                this.plantStump(options, chunk, x, y, z);
                break;
            }
            // tundra_stone
            case 'tundra_stone': {
                this.plantTundraStone(options, chunk, x, y, z);
                break;
            }
            // дуб, берёза
            case 'birch':
            case 'oak':
            case 'wood': {
                this.plantOak(options, chunk, x, y, z, check_chunk_size);
                break;
            }
            // mushroom
            case 'mushroom': {
                this.plantMushroom(options, chunk, x, y, z);
                break;
            }
            // акация
            case 'acacia': {
                this.plantAcacia(options, chunk, x, y, z, check_chunk_size);
                break;
            }
            // ель
            case 'spruce': {
                this.plantSpruce(options, chunk, x, y, z, check_chunk_size);
                break;
            }
            // тропическое дерево
            case 'tropical_tree': {
                this.plantTropicalTree(options, chunk, x, y, z, check_chunk_size);
                break;
            }

        }
    }

    // Кактус
    plantCactus(options, chunk, x, y, z, block, force_replace) {
        const ystart = y + options.height;
        // ствол
        this.temp_block.id = options.type.trunk;
        for(let p = y; p < ystart; p++) {
            this.setBlock(chunk, x, p, z, this.temp_block, true);
        }
    }

    // Бамбук
    plantBamboo(options, chunk, x, y, z, block, force_replace) {
        const ystart = y + options.height;
        // ствол
        this.temp_block.id = options.type.trunk;
        for(let p = y; p < ystart; p++) {
            let extra_data = {stage: 3};
            if(p == ystart - 1) extra_data.stage = 2;
            if(p == ystart - 2) extra_data.stage = 1;
            if(p == ystart - 3) extra_data.stage = 1;
            this.setBlock(chunk, x, p, z, this.temp_block, true, null, extra_data);
        }
    }

    // Пенёк
    plantStump(options, chunk, x, y, z, block, force_replace) {
        const ystart = y + options.height;
        // ствол
        this.temp_block.id = options.type.trunk;
        for(let p = y; p < ystart; p++) {
            this.setBlock(chunk, x, p, z, this.temp_block, true);
        }
        if(options.type.leaves) {
            this.temp_block.id = options.type.leaves;
            this.setBlock(chunk, x, ystart, z, this.temp_block, true);
        }
    }

    // Tundra stone
    plantTundraStone(options, chunk, x, y, z, block, force_replace) {
        y--;
        const ystart = y + options.height;
        // ствол
        this.temp_block.id = options.type.trunk;
        for(let p = y; p < ystart; p++) {
            for(let dx = -1; dx <= 1; dx++) {
                for(let dz = -1; dz <= 1; dz++) {
                    if(p != y && dx != 0 && dz != 0) {
                        continue;
                    }
                    this.setBlock(chunk, x + dx, p, z + dz, this.temp_block, true);
                }
            }
        }
    }

    // Акация
    plantAcacia(options, chunk, orig_x, orig_y, orig_z, check_chunk_size = true) {
        // let xyz = chunk.coord.add(new Vector(orig_x, orig_y, orig_z));
        // let random = new alea('tree' + xyz.toHash());
        let iterations = 0;
        let that = this;
        let plant = function(x, y, z, height, px, pz, rads) {
            let ystart = y + height;
            // ствол
            for(let p = y; p < ystart; p++) {
                x += px;
                z += pz;
                that.temp_block.id = options.type.trunk;
                that.setBlock(chunk, x, p, z, that.temp_block, true);
                // let r = random.double();
                let r = that.fastRandoms.double(x + p + z + chunk.coord.x + chunk.coord.y + chunk.coord.z + height);
                if(iterations == 0 && r < .1 && p <= y+height/2) {
                    r *= 10;
                    iterations++;
                    let px2 = r < .5 ? 1 : 0;
                    if(r < .25) px2 * -1;
                    let pz2 = r < .5 ? 0 : 1;
                    if(r < .75) pz2 * -1;
                    plant(x, p + 1, z, (r * 2 + 2) | 0, px2, pz2, [1, 2]);
                    if(r < .3) {
                        return;
                    }
                }
            }
            // листва
            let py = y + height;
            const vec1 = new Vector$1();
            const vec2 = new Vector$1();
            for(let rad of rads) {
                for(let i = x - rad; i <= x + rad; i++) {
                    for(let j = z - rad; j <= z + rad; j++) {
                        if(!check_chunk_size || (i >= 0 && i < chunk.size.x && j >= 0 && j < chunk.size.z)) {
                            vec1.set(x, 0, z);
                            vec2.set(i, 0, j);
                            if(vec1.distance(vec2) > rad) {
                                continue;
                            }
                            that.xyz_temp_find.set(i, py, j);
                            let b = chunk.tblocks.get(that.xyz_temp_find);
                            let b_id = !b ? 0 : (typeof b == 'number' ? b : b.id);
                            if(!b_id || b_id >= 0 && b_id != options.type.trunk) {
                                that.temp_block.id = options.type.leaves;
                                that.setBlock(chunk, i, py, j, that.temp_block, false);
                            }
                        }
                    }
                }
                py--;
            }
        };
        plant(orig_x, orig_y, orig_z, options.height, 0, 0, [2, 3]);
    }

    // Ель
    plantSpruce(options, chunk, x, y, z, check_chunk_size = true) {
        let max_rad = 5;
        let ystart = y + options.height;
        let b = null;
        // ствол
        for(let p = y; p < ystart; p++) {
            this.temp_block.id = options.type.trunk;
            this.setBlock(chunk, x, p, z, this.temp_block, true);
        }
        // листва
        let r = 1;
        let rad = Math.round(r);
        if(!check_chunk_size || (x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z)) {
            this.temp_block.id = options.type.leaves;
            this.setBlock(chunk, x, ystart, z, this.temp_block, false);
            if(options.biome_code == 'SNOW') {
                this.temp_block.id = BLOCK$1.SNOW.id;
                this.setBlock(chunk, x, ystart + 1, z, this.temp_block, false);
            }
        }
        let step = 0;
        let temp_rad = 0;
        for(let y = ystart - 1; y > ystart - (options.height - 1); y--) {
            step++;
            if(step % 2 == 0) {
                rad = Math.min(Math.round(r), max_rad);
                temp_rad = rad;
            } else if(step == 1) {
                rad = options.height % 2;
                temp_rad = rad;
            } else {
                rad = temp_rad - 1;
            }
            for(let i = x - rad; i <= x + rad; i++) {
                for(let j = z - rad; j <= z + rad; j++) {
                    if(!check_chunk_size || (i >= 0 && i < chunk.size.x && j >= 0 && j < chunk.size.z)) {
                        if(Math.sqrt(Math.pow(x - i, 2) + Math.pow(z - j, 2)) <= rad) {
                            this.xyz_temp_find.set(i + chunk.coord.x, y + chunk.coord.y, j + chunk.coord.z);
                            b = chunk.tblocks.get(this.xyz_temp_find, b);
                            let b_id = b.id;
                            if(!b_id || b_id >= 0 && b_id != options.type.trunk) {
                                this.temp_block.id = options.type.leaves;
                                this.setBlock(chunk, i, y, j, this.temp_block, false);
                                if(options.biome_code == 'SNOW') {
                                    this.temp_block.id = BLOCK$1.SNOW.id;
                                    this.setBlock(chunk, i, y + 1, j, this.temp_block, false);
                                }
                            }
                        }
                    }
                }
            }
            r = Math.sqrt(step);
            if(r < 1.5) {
                this.temp_block.id = options.type.leaves;
                this.setBlock(chunk, x, y, z, this.temp_block, true);
            }
        }
    }

    // Дуб, берёза
    plantOak(options, chunk, x, y, z, check_chunk_size = true) {
        let ystart = y + options.height;
        // ствол
        for(let p = y; p < ystart; p++) {
            this.temp_block.id = options.type.trunk;
            this.setBlock(chunk, x, p, z, this.temp_block, true);
        }
        // листва
        let py = y + options.height;
        let b = null;
        for(let rad of [1, 1, 2, 2]) {
            for(let i = x - rad; i <= x + rad; i++) {
                for(let j = z - rad; j <= z + rad; j++) {
                    if(!check_chunk_size || (i >= 0 && i < chunk.size.x && j >= 0 && j < chunk.size.z)) {
                        let m = (i == x - rad && j == z - rad) ||
                            (i == x + rad && j == z + rad) ||
                            (i == x - rad && j == z + rad) ||
                            (i == x + rad && j == z - rad);
                            let m2 = (py == y + options.height) ||
                            (i + chunk.coord.x + j + chunk.coord.z + py) % 3 > 0;
                        if(m && m2) {
                            continue;
                        }
                        this.xyz_temp_find.set(i, py, j);
                        b = chunk.tblocks.get(this.xyz_temp_find, b);
                        let b_id = b.id;
                        if(!b_id || b_id >= 0 && b_id != options.type.trunk) {
                            this.temp_block.id = options.type.leaves;
                            this.setBlock(chunk, i, py, j, this.temp_block, false);
                        }
                    }
                }
            }
            py--;
        }
    }

    // Mushroom
    plantMushroom(options, chunk, x, y, z) {
        let ystart = y + options.height;
        // ствол
        for(let p = y; p < ystart; p++) {
            this.temp_block.id = options.type.trunk;
            this.setBlock(chunk, x, p, z, this.temp_block, true);
        }
        // листва
        let py = y + options.height;
        let b = null;
        for(let rad of [1, 2, 2, 2]) {
            for(let i = -rad; i <= rad; i++) {
                for(let j = -rad; j <= rad; j++) {
                    if(py < y + options.height) {
                        if(Math.abs(i) < 2 && Math.abs(j) < 2) {
                            continue;
                        }
                    }
                    if(i + x >= 0 && i + x < chunk.size.x && j + z >= 0 && j + z < chunk.size.z) {
                        let m = (i == -rad && j == -rad) ||
                            (i == rad && j == rad) ||
                            (i == -rad && j == rad) ||
                            (i == rad && j == -rad);
                        if(m && py < y + options.height) {
                            continue;
                        }
                        this.xyz_temp_find.set(i + x, py, j + z);
                        b = chunk.tblocks.get(this.xyz_temp_find, b);
                        let b_id = b.id;
                        if(!b_id || b_id >= 0 && b_id != options.type.trunk) {
                            this.temp_block.id = options.type.leaves;
                            // determining which side to cover with which texture
                            let t = 0;
                            if(py >= y + options.height - 1) t |= (1 << DIRECTION_BIT$1.UP); // up
                            if(i == rad) t |= (1 << DIRECTION_BIT$1.EAST); // east x+
                            if(i == -rad) t |= (1 << DIRECTION_BIT$1.WEST); // west x-
                            if(j == rad) t |= (1 << DIRECTION_BIT$1.NORTH); // north z+
                            if(j == -rad) t |= (1 << DIRECTION_BIT$1.SOUTH); // south z-
                            //
                            if(py < y + options.height) {
                                if((j == -rad || j == rad) && i == rad - 1) t |= (1 << DIRECTION_BIT$1.EAST); // east x+
                                if((j == -rad || j == rad) && i == -rad + 1) t |= (1 << DIRECTION_BIT$1.WEST); // west x-
                                if((i == -rad || i == rad) && j == rad - 1) t |= (1 << DIRECTION_BIT$1.NORTH); // north z+
                                if((i == -rad || i == rad) && j == -rad + 1) t |= (1 << DIRECTION_BIT$1.SOUTH); // south z-
                            }
                            let extra_data = t ? {t: t} : null;
                            this.setBlock(chunk, i + x, py, j + z, this.temp_block, false, null, extra_data);
                        }
                    }
                }
            }
            py--;
        }
    }

    // Тропическое дерево
    plantTropicalTree(options, chunk, x, y, z, check_chunk_size = true) {
        const TREE_HEIGHT = options.height - 2; // рандомная высота дерева, переданная из генератора
        let ystart = y + TREE_HEIGHT;
        let maxW = Math.floor(TREE_HEIGHT / 2);
        let minW = Math.floor(TREE_HEIGHT / 3);
        this.temp_block.id = options.type.trunk;
        let mainseed = x + z + chunk.coord.x + chunk.coord.y + chunk.coord.z + y;
        // получаю большое число
        let cnt = Math.floor(
            this.fastRandoms.double(mainseed + options.height) * Math.pow(2, 58)
        );
        let dy = Math.floor(cnt / 2 ** 32);
        // преобразование числа в массив байт
        let arr = [
            cnt << 24,
            cnt << 16,
            cnt << 8,
            cnt,
            dy << 24,
            dy << 16,
            dy << 8,
            dy,
        ].map((z) => z >>> 24);
        // ствол + лианы вокруг
        let xyz = chunk.coord.add(new Vector$1(x, y, z));
        let random = new impl('tree' + xyz.toHash());
        for (let p = y; p < ystart; p++) {
            this.setBlock(chunk, x, p, z, this.temp_block, true);
            let block_id = BLOCK$1.VINES.id;
            let extra_data = null;
            const makeCocoa = () => {
                if(random.double() < .04 && p < y + 4) {
                    block_id = BLOCK$1.COCOA_BEANS.id;
                    extra_data = {stage: 2};
                }
            };
            if ((p + arr[p % 7]) % 2 == 0) {
                makeCocoa();
                this.setBlock(chunk, x + 1, p, z, { id: block_id }, false, {
                    x: 3,
                    y: 0,
                    z: 0,
                }, extra_data);
            }
            if ((p + arr[(p + 1) % 7]) % 2 == 0) {
                makeCocoa();
                this.setBlock(chunk, x - 1, p, z, { id: block_id }, false, {
                    x: 1,
                    y: 0,
                    z: 0,
                }, extra_data);
            }
            if ((p + arr[(p + 2) % 7]) % 2 == 0) {
                makeCocoa();
                this.setBlock(chunk, x, p, z + 1, { id: block_id }, false, {
                    x: 0,
                    y: 0,
                    z: 3,
                }, extra_data);
            }
            if ((p + arr[(p + 3) % 7]) % 2 == 0) {
                makeCocoa();
                this.setBlock(chunk, x, p, z - 1, { id: block_id }, false, {
                    x: 2,
                    y: 0,
                    z: 0,
                }, extra_data);
            }
        }
        // рисование кроны дерева
        const generateLeaves = (x, y, z, rad, rnd) => {
            for (let h = 0; h <= 1; h++) {
                let w = Math.max(rad - h * 2, 5 - h);
                let dx = Math.floor(x - w / 2);
                let dz = Math.floor(z - w / 2);
                let d = null;
                for (let a = dx; a <= dx + w; a++) {
                    for (let b = dz; b <= dz + w; b++) {
                        if(a < 0 || a >= chunk.size.x || b < 0 || b >= chunk.size.z) {
                            continue;
                        }
                        let l = Math.abs(Math.sqrt(Math.pow(a - x, 2) + Math.pow(b - z, 2)));
                        if (l <= w / 2) {
                            this.xyz_temp_find.set(a, y + h, b);
                            d = chunk.tblocks.get(this.xyz_temp_find, d);
                            let d_id = d.id;
                            if (!d_id || (d_id >= 0 && d_id != options.type.trunk)) {
                                this.temp_block.id = options.type.leaves;
                                this.setBlock(chunk, a, y + h, b, this.temp_block, false);
                                if (
                                    rad % 2 == 0 &&
                                    h == 0 &&
                                    (a == dx || a == dx + w || b == dz || b == dz + w)
                                ) {
                                    for (
                                        let t = 1;
                                        t <= Math.floor(1 + rad * (arr[1 + (t % 6)] / 255));
                                        t++
                                    ) {
                                        this.setBlock(
                                            chunk,
                                            a,
                                            y + h - t,
                                            b,
                                            { id: BLOCK$1.VINES.id },
                                            false,
                                            {
                                                x: a == dx ? 3 : a == dx + w ? 1 : b == dz + w ? 2 : 0,
                                                y: 0,
                                                z: b == dz ? 3 : 0,
                                            }
                                        );
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };
        // построение веток дерева
        for (let i = 0; i < arr[7]; i++) {
            this.temp_block.id = options.type.trunk;
            let pos = Math.floor(
                TREE_HEIGHT / 2.5 + (TREE_HEIGHT / 2) * (arr[6 - i] / 255)
            );
            let rad = Math.floor(minW + (maxW * arr[1 + i]) / 255 / 4);
            let side = (i + (arr[7] % 2)) % 4;
            let x1 = x;
            let z1 = z;
            let dy = 0;
            for (let k = 0; k < rad; k++) {
                x1 = side < 2 ? (side == 0 ? x1 - 1 : x1 + 1) : x1;
                z1 = side >= 2 ? (side == 2 ? z1 - 1 : z1 + 1) : z1;
                if (arr[k % 7] % 2 == 0) {
                    dy++;
                }
                this.setBlock(chunk, x1, y + pos + dy, z1, this.temp_block, true);
            }

            this.temp_block.id = options.type.leaves;
            generateLeaves(x1, y + pos + dy + 1, z1, rad, arr);
        }
        // рисуем крону основного дерева
        this.temp_block.id = options.type.leaves;
        generateLeaves(x, ystart, z, Math.floor(minW + (maxW * arr[0]) / 255), arr);
    }

}

let size = new Vector$1(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);

const SMOOTH_RAD         = 3;
const SMOOTH_RAD_CNT     = Math.pow(SMOOTH_RAD * 2 + 1, 2);
const SMOOTH_ROW_COUNT   = CHUNK_SIZE_X + SMOOTH_RAD * 4 + 1;

// for clusters
const PLANT_MARGIN       = 0;
const TREE_MARGIN        = 3;
const MAP_CLUSTER_MARGIN = 5;

const MAP_SCALE = .5;

const GENERATOR_OPTIONS = {
    WATER_LINE:             63, // Ватер-линия
    SCALE_EQUATOR:          1280 * MAP_SCALE * 3, // Масштаб для карты экватора
    SCALE_BIOM:             640  * MAP_SCALE, // Масштаб для карты шума биомов
    SCALE_HUMIDITY:         320  * MAP_SCALE, // Масштаб для карты шума влажности
    SCALE_VALUE:            250  * MAP_SCALE // Масштаб шума для карты высот
};

//
// Rivers
const RIVER_SCALE = .5;
const RIVER_NOISE_SCALE = 4.5;
const RIVER_WIDTH = 0.008 * RIVER_SCALE;
const RIVER_OCTAVE_1 = 512 / RIVER_SCALE;
const RIVER_OCTAVE_2 = RIVER_OCTAVE_1 / RIVER_NOISE_SCALE;
const RIVER_OCTAVE_3 = 48 / RIVER_SCALE;

//
const temp_chunk = {
    addr: new Vector$1(),
    coord: new Vector$1(),
    size: size
};

// Map manager
class TerrainMapManager {

    static _temp_vec3 = Vector$1.ZERO.clone();
    static _temp_vec3_delete = Vector$1.ZERO.clone();

    constructor(seed, world_id, noisefn) {
        this.seed = seed;
        this.world_id = world_id;
        this.noisefn = noisefn;
        this.maps_cache = new VectorCollector();
        BIOMES.init();
    }

    // Delete map for unused chunk
    delete(addr) {
        TerrainMapManager._temp_vec3_delete.copyFrom(addr);
        TerrainMapManager._temp_vec3_delete.y = 0;
        this.maps_cache.delete(TerrainMapManager._temp_vec3_delete);
    }

    // Return map
    get(addr) {
        return this.maps_cache.get(addr);
    }

    // Generate maps
    generateAround(chunk, chunk_addr, smooth, vegetation) {
        const rad                   = vegetation ? 2 : 1;
        const noisefn               = this.noisefn;
        let maps                    = [];
        let center_map              = null;
        for(let x = -rad; x <= rad; x++) {
            for(let z = -rad; z <= rad; z++) {
                TerrainMapManager._temp_vec3.set(x, -chunk_addr.y, z);
                temp_chunk.addr.copyFrom(chunk_addr).addSelf(TerrainMapManager._temp_vec3);
                temp_chunk.coord.copyFrom(temp_chunk.addr).multiplyVecSelf(size);
                const map = this.generateMap(chunk, temp_chunk, noisefn);
                if(Math.abs(x) < 2 && Math.abs(z) < 2) {
                    maps.push(map);
                }
                if(x == 0 && z == 0) {
                    center_map = map;
                }
            }
        }
        // Smooth (for central and part of neighbours)
        if(smooth && !center_map.smoothed) {
            center_map.smooth(this);
        }
        // Generate vegetation
        if(vegetation) {
            for (let i = 0; i < maps.length; i++) {
                const map = maps[i];
                if(!map.vegetable_generated) {
                    if(smooth && !map.smoothed) {
                        map.smooth(this);
                    }
                    map.generateVegetation(chunk, this.seed);
                }
            }
        }
        return maps;
    }

    //
    makePoint(px, pz, cluster_is_empty, cluster_max_height) {
        const noisefn = this.noisefn;
        const H = 68;
        const HW = 64;
        // Влажность
        let humidity = Helpers.clamp((noisefn(px / GENERATOR_OPTIONS.SCALE_HUMIDITY, pz / GENERATOR_OPTIONS.SCALE_HUMIDITY) + 0.5) / 2, 0, 1);
        // Экватор
        let equator = Helpers.clamp((noisefn(px / GENERATOR_OPTIONS.SCALE_EQUATOR, pz / GENERATOR_OPTIONS.SCALE_EQUATOR) + 0.8), 0, 1);
        // Высота горы в точке
        const octave1 = noisefn(px / 20, pz / 20);

        let value = noisefn(px / 150, pz / 150, 0) * .4 +
            noisefn(px / 1650, pz / 1650) * .1 +
            noisefn(px / 650, pz / 650) * .25 +
            octave1 * .05 +
            noisefn(px / 350, pz / 350) * .5 +
            noisefn(px / 25, pz / 25) * (0.01568627 * octave1);
        // Get biome
        let biome = BIOMES.getBiome((value * HW + H) / 255, humidity, equator);

        const is_ocean = biome.code == 'OCEAN';

        if(is_ocean) {
            cluster_max_height = null;
        }

        const river_point = this.makeRiverPoint(px, pz);
        if(river_point) {
            if(cluster_is_empty) {
                // smooth with clusters
                if(cluster_max_height) {
                    value = value * (cluster_max_height ? Math.min(cluster_max_height - 1, (cluster_max_height + biome.max_height) / 2) : biome.max_height) + H;
                    value = parseInt(value);
                    return {value, biome, humidity, equator};
                } else {
                    if(!is_ocean) {
                        biome = BIOMES.RIVER;
                        value = -0.127;
                    }
                }
            } else {
                if(!is_ocean) {
                    biome = BIOMES.RIVER;
                    value = -0.22 * (river_point / 1.5);
                }
            }
        }

        if(biome.no_smooth) {
            value = value * biome.max_height + H;
        } else {
            // smooth with clusters
            value = value * (cluster_max_height ? Math.min(cluster_max_height - 1, (cluster_max_height + biome.max_height) / 2) : biome.max_height) + H;
        }
        value = parseInt(value);
        // value = Helpers.clamp(value, 4, 2500);
        biome = BIOMES.getBiome(value / 255, humidity, equator);
        // Pow
        let diff = value - GENERATOR_OPTIONS.WATER_LINE;
        if(diff < 0) {
            value -= (GENERATOR_OPTIONS.WATER_LINE - value) * .65 - 1.5;
        } else {
            value = GENERATOR_OPTIONS.WATER_LINE + Math.pow(diff, 1 + diff / HW);
        }
        value = parseInt(value);
        return {value, biome, humidity, equator};
    }

    // rivers
    makeRiverPoint(x, z) {

        let m = this.noisefn(x / 64, z / 64) * 2;
        if(m < 0) m*= -1;
        m++;

        const s = 1;

        const rw = RIVER_WIDTH * m;
        const o1 = RIVER_OCTAVE_1 / s;
        let value = this.noisefn(x / o1, z / o1) * 0.7 +
                    this.noisefn(x / RIVER_OCTAVE_2, z / RIVER_OCTAVE_2) * 0.2 +
                    this.noisefn(x / RIVER_OCTAVE_3, z / RIVER_OCTAVE_3) * 0.1;
        if(value < 0) {
            value *= -1;
        }
        if(value > rw) {
            return null;
        }
        value = 1 - value / rw;
        return value;
    }

    // generateMap
    generateMap(real_chunk, chunk, noisefn) {
        let cached = this.maps_cache.get(chunk.addr);
        if(cached) {
            return cached;
        }
        // Result map
        const map = new TerrainMap(chunk, GENERATOR_OPTIONS);
        if(!real_chunk.chunkManager) {
            debugger
        }
        const cluster = real_chunk.chunkManager.clusterManager.getForCoord(chunk.coord);
        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {
                let px = chunk.coord.x + x;
                let pz = chunk.coord.z + z;
                let cluster_max_height = null;
                if(!cluster.is_empty && cluster.cellIsOccupied(px, 0, pz, MAP_CLUSTER_MARGIN)) {
                    cluster_max_height = cluster.max_height;
                }
                const {value, biome, humidity, equator} = this.makePoint(px, pz, cluster.is_empty, cluster_max_height);
                // Different dirt blocks
                let dirt_block_id = biome.dirt_block[0];
                if(biome.dirt_block.length > 1) {
                    const ns = noisefn(px / 5, pz / 5);
                    const index = parseInt(biome.dirt_block.length * Helpers.clamp(Math.abs(ns + .3), 0, .999));
                    dirt_block_id = biome.dirt_block[index];
                }
                // Create map cell
                map.cells[z * CHUNK_SIZE_X + x] = new TerrainMapCell(value, humidity, equator, biome, dirt_block_id);
            }
        }
        this.maps_cache.set(chunk.addr, map);
        // console.log(`Actual maps count: ${this.maps_cache.size}`);
        return map;
    }

    destroyAroundPlayers(players) {
        let cnt_destroyed = 0;
        for(let [map_addr, _] of this.maps_cache.entries()) {
            let can_destroy = true;
            for(let player of players) {
                const {chunk_render_dist, chunk_addr} = player;
                if(map_addr.distance(chunk_addr) < chunk_render_dist + 3) {
                    can_destroy = false;
                }
            }
            if(can_destroy) {
                this.maps_cache.delete(map_addr);
                cnt_destroyed++;
            }
        }
        //if(cnt_destroyed > 0) {
        //    console.log(`Destroyed maps: ${cnt_destroyed}`);
        //}
    }

}

// Map
class TerrainMap {

    static _cells;

    // Constructor
    constructor(chunk, options) {
        this.options        = options;
        this.trees          = [];
        this.plants         = new VectorCollector();
        this.smoothed       = false;
        this.vegetable_generated = false;
        this.cells          = Array(chunk.size.x * chunk.size.z); // .fill(null);
        this.chunk          = {
            size: chunk.size,
            addr: chunk.addr.clone(),
            coord: chunk.coord.clone()
        };
    }

    static initCells() {
        TerrainMap._cells = new Array(SMOOTH_ROW_COUNT);
        TerrainMap._vals = new Array(SMOOTH_ROW_COUNT * 3);
        TerrainMap._sums = new Array(SMOOTH_ROW_COUNT * 3);
    }

    static getCell(x, z) {
        return TerrainMap._cells[(z * SMOOTH_ROW_COUNT) + x];
    }

    static setCell(x, z, value) {
        TerrainMap._cells[(z * SMOOTH_ROW_COUNT) + x] = value;
    }

    static setPartial(x, z, cell) {
        x += SMOOTH_RAD * 2;
        z += SMOOTH_RAD * 2;
        const ind = ((z * SMOOTH_ROW_COUNT) + x);
        TerrainMap._cells[ind] = cell;
        TerrainMap._vals[ind * 3] = cell.value;
        TerrainMap._vals[ind * 3 + 1] = cell.biome.dirt_color.r;
        TerrainMap._vals[ind * 3 + 2] = cell.biome.dirt_color.g;
    }

    static calcSum() {
        const vals = TerrainMap._vals;
        const sums = TerrainMap._sums;
        sums[0] = 0;
        sums[1] = 0;
        sums[2] = 0;
        const ROW3 = SMOOTH_ROW_COUNT * 3;
        const COL3 = 3;
        for (let x = 1; x < SMOOTH_ROW_COUNT; x++) {
            const ind = x * 3;
            sums[ind] = sums[ind - COL3] + vals[ind - COL3];
            sums[ind + 1] = sums[ind - COL3 + 1] + vals[ind - COL3 + 1];
            sums[ind + 2] = sums[ind - COL3 + 2] + vals[ind - COL3 + 2];
        }
        for (let z = 1; z < SMOOTH_ROW_COUNT; z++) {
            const ind = z * (ROW3);
            sums[ind] = sums[ind - ROW3] + vals[ind - ROW3];
            sums[ind + 1] = sums[ind - ROW3 + 1] + vals[ind - ROW3 + 1];
            sums[ind + 2] = sums[ind - ROW3 + 2] + vals[ind - ROW3 + 2];

            for (let x = 1; x < SMOOTH_ROW_COUNT; x++) {
                for (let k = 0; k < 3; k++) {
                    const ind = ((z * SMOOTH_ROW_COUNT) + x) * 3 + k;
                    sums[ind] = sums[ind - ROW3] + sums[ind - COL3]
                        - sums[ind - ROW3 - COL3]
                        + vals[ind - ROW3 - COL3];
                }
            }
        }
    }

    // Сглаживание карты высот
    smooth(generator) {
        // 1. Кеширование ячеек
        let map             = null;
        let addr            = new Vector$1(0, 0, 0);
        let bi              = new Vector$1(0, 0, 0);

        for(let x = -SMOOTH_RAD * 2; x < CHUNK_SIZE_X + SMOOTH_RAD * 2; x++) {
            for(let z = -SMOOTH_RAD * 2; z < CHUNK_SIZE_Z + SMOOTH_RAD * 2; z++) {
                // absolute cell coord
                let px          = this.chunk.coord.x + x;
                let pz          = this.chunk.coord.z + z;
                addr            = getChunkAddr(px, 0, pz, addr); // calc chunk addr for this cell
                if(!map || map.chunk.addr.x != addr.x || map.chunk.addr.z != addr.z) {
                    map = generator.maps_cache.get(addr); // get chunk map from cache
                }
                bi = BLOCK.getBlockIndex(px, 0, pz, bi);
                const cell = map.cells[bi.z * CHUNK_SIZE_X + bi.x];
                TerrainMap.setPartial(x, z, cell);
            }
        }
        // 2. Smoothing | Сглаживание
        let colorComputer = new Color(SMOOTH_RAD_CNT, SMOOTH_RAD_CNT, SMOOTH_RAD_CNT, SMOOTH_RAD_CNT);

        TerrainMap.calcSum();
        const sums = TerrainMap._sums, cells = TerrainMap._cells;
        for(let x = 0; x < CHUNK_SIZE_X; x++) {
            for(let z = 0; z < CHUNK_SIZE_Z; z++) {
                const ind = (z + SMOOTH_RAD * 2) * SMOOTH_ROW_COUNT + (x + SMOOTH_RAD * 2);
                let cell        = cells[ind];

                const ind1 = ind - SMOOTH_RAD * SMOOTH_ROW_COUNT - SMOOTH_RAD;
                const ind2 = ind - SMOOTH_RAD * SMOOTH_ROW_COUNT + (SMOOTH_RAD + 1);
                const ind3 = ind + (SMOOTH_RAD + 1) * SMOOTH_ROW_COUNT - SMOOTH_RAD;
                const ind4 = ind + (SMOOTH_RAD + 1) * SMOOTH_ROW_COUNT + (SMOOTH_RAD + 1);
                let height_sum  = sums[ind1 * 3] + sums[ind4 * 3] - sums[ind2 * 3] - sums[ind3 * 3];
                let dirt_color  = new Color(
                    sums[ind1 * 3 + 1] + sums[ind4 * 3 + 1] - sums[ind2 * 3 + 1] - sums[ind3 * 3 + 1],
                sums[ind1 * 3 + 2] + sums[ind4 * 3 + 2] - sums[ind2 * 3 + 2] - sums[ind3 * 3 + 2],
                    0, 0);
                // Не сглаживаем блоки пляжа и океана
                let smooth = !(cell.value > this.options.WATER_LINE - 2 && cell.biome.no_smooth);
                if(smooth) {
                    cell.value2 = Math.floor(height_sum / SMOOTH_RAD_CNT);
                    if(cell.value2 <= this.options.WATER_LINE) {
                        cell.biome = BIOMES.OCEAN;
                    }
                }
                cell.dirt_color = dirt_color.divide(colorComputer);
            }
        }

        this.smoothed = true;

    }

    // Генерация растительности
    generateVegetation(real_chunk, seed) {
        let chunk                   = this.chunk;
        this.vegetable_generated    = true;
        this.trees                  = [];
        this.plants                 = new VectorCollector();
        let aleaRandom              = null;
        let biome                   = null;
        let cluster                 = null;
        const plant_pos             = new Vector$1(0, 0, 0);
        //
        const addPlant = (rnd, x, y, z) => {
            let s = 0;
            let r = rnd / biome.plants.frequency;
            plant_pos.x = x;
            plant_pos.y = y;
            plant_pos.z = z;
            for (let i = 0; i < biome.plants.list.length; i++) {
                const p = biome.plants.list[i];
                s += p.percent;
                if(r < s) {
                    if(p.block) {
                        this.plants.set(plant_pos, p.block);
                    } else if(p.trunk) {
                        this.plants.set(plant_pos, p.trunk);
                        plant_pos.y++;
                        this.plants.set(plant_pos, p.leaves);
                    }
                    break;
                }
            }
        };
        //
        const addTree = (rnd, x, y, z) => {
            let s = 0;
            let r = rnd / biome.trees.frequency;
            for(let type of biome.trees.list) {
                s += type.percent;
                if(r < s) {
                    if(!cluster.is_empty && cluster.cellIsOccupied(x + chunk.coord.x, y + chunk.coord.y - 1, z + chunk.coord.z, TREE_MARGIN)) {
                        break;
                    }
                    let r = aleaRandom.double();
                    const height = Helpers.clamp(Math.round(r * (type.height.max - type.height.min) + type.height.min), type.height.min, type.height.max);
                    const rad = Math.max(parseInt(height / 2), 2);
                    this.trees.push({
                        biome_code: biome.code,
                        pos:        new Vector$1(x, y, z),
                        height:     height,
                        rad:        rad,
                        type:       type
                    });
                    return true;
                }
            }
            return false;
        };
        //
        const initAleaAndCluster = () => {
            if(aleaRandom) {
                return false;
            }
            aleaRandom = new impl(seed + '_' + chunk.coord.toString());
            cluster = real_chunk.chunkManager.clusterManager.getForCoord(chunk.coord);
            return true;
        };
        //
        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {
                const cell = this.cells[z * CHUNK_SIZE_X + x];
                biome = cell.biome;
                if(biome.plants.frequency == 0 && biome.trees.frequency == 0) {
                    continue;
                }
                // Растения, цветы, трава (только если на поверхности блок земли)
                if(biome.dirt_block.indexOf(cell.dirt_block_id) < 0) {
                    continue;
                }
                //
                initAleaAndCluster();
                const y = cell.value2;
                if(!cluster.is_empty && cluster.cellIsOccupied(x + chunk.coord.x, y + chunk.coord.y - 1, z + chunk.coord.z, PLANT_MARGIN)) {
                    continue;
                }
                //
                const rnd = aleaRandom.double();
                if(rnd <= 0) {
                    continue;
                }
                if(rnd <= biome.trees.frequency) {
                    // Деревья
                    if(addTree(rnd, x, y, z)) {
                        continue;
                    }
                }
                if(rnd <= biome.plants.frequency) {
                    // Трава
                    addPlant(rnd, x, y, z);
                }
            }
        }
    }

}

// Map cell
class TerrainMapCell {

    constructor(value, humidity, equator, biome, dirt_block_id) {
        this.value          = value;
        this.value2         = value;
        this.humidity       = Math.round(humidity * 100000) / 100000;
        this.equator        = Math.round(equator * 100000) / 100000;
        this.biome          = biome;
        this.dirt_block_id  = dirt_block_id;
    }

}

TerrainMap.initCells();

const SIZE_CLUSTER = 8;
const LANTERN_ROT_UP = new Vector$1(0, -1, 0);
const LANTERN_CHANCE = 0.02;
const CHEST_ROT = new Vector$1(DIRECTION.SOUTH, 1, 0);
const MINE_SIZE = new Vector$1(CHUNK_SIZE_X * SIZE_CLUSTER, 40, CHUNK_SIZE_Z * SIZE_CLUSTER);
const NODE_SIZE = new Vector$1(CHUNK_SIZE_X, 4, CHUNK_SIZE_Z);
const NODE_COUNT = new Vector$1(MINE_SIZE.x / NODE_SIZE.x, MINE_SIZE.y / NODE_SIZE.y, MINE_SIZE.z / NODE_SIZE.z);

/**
 * Draw mines
 * @class MineGenerator
 * @param {World} world world
 * @param {Vector} pos chunk positon
 * @param {object} options options
 */
class MineGenerator {

    static all = new VectorCollector();

    constructor(generator, addr, options = {}) {
        this.generator          = generator;
        this.addr               = addr.clone();
        this.coord              = (new Vector$1(addr.x, addr.y, addr.z)).multiplyVecSelf(MINE_SIZE);
        this.random             = new impl(this.addr.toHash());
        this.is_empty           = this.random.double() > .25;
        if(this.is_empty) {
            return;
        }
        //
        this.size_cluster       = (options.size_cluster) ? options.size_cluster : 8;
        this.chance_hal         = (options.chance_hal) ? options.chance_hal : 0.75;
        this.chance_cross       = (options.chance_cross) ? options.chance_cross : 0.6;
        this.chance_side_room   = (options.chance_side_room) ? options.chance_side_room : 0.5;
        //
        this._get_vec           = new Vector$1(0, 0, 0);
        this.voxel_buildings    = [];
        //
        let pn = performance.now();
        this.nodes = new VectorCollector();
        const bottom_y = Math.floor(this.random.double() * (NODE_COUNT.y - 2));
        const x = Math.round(NODE_COUNT.x / 2);
        const z = Math.round(NODE_COUNT.z / 2);
        this.genNodeMine(x, bottom_y, z, DIRECTION.SOUTH);
        this.is_empty = this.nodes.size == 0;
        const ms = Math.round((performance.now() - pn) * 1000) / 1000;
        // console.log("[INFO]MineGenerator: generation " + this.nodes.size + " nodes for " + ms + ' ms on height ' + bottom_y);

        this.xyz_temp_coord = new Vector$1(0, 0, 0);
    }

    // getForCoord
    static getForCoord(generator, coord) {
        const addr = new Vector$1(coord.x, 0, coord.z).divScalarVec(MINE_SIZE).flooredSelf();
        let mine = MineGenerator.all.get(addr);
        if(mine) {
            return mine;
        }
        let options = {
            'chance_hal' : 0.4
        };
        mine = new MineGenerator(generator, addr, options);
        MineGenerator.all.set(addr, mine);
        return mine;
    }

    // generate node
    genNodeMine(x, y, z, dir) {

        if (x > NODE_COUNT.x || x < 0 || y > NODE_COUNT.y || y < 0 || z > NODE_COUNT.z || z < 0) {
            return;
        }

        let new_x = x, new_y = y, new_z = z;

        if (dir == DIRECTION.SOUTH) {
            ++new_z;
        } else if (dir == DIRECTION.EAST) {
            ++new_x;
        } else if (dir == DIRECTION.NORTH) {
            --new_z;
        } else if (dir == DIRECTION.WEST){
            --new_x;
        }

        if (this.nodes.size == 0) {
            this.addNode(x, y, z, dir, 'cross'); // enter
            this.genNodeMine(x, y, z, this.wrapRotation(DIRECTION.NORTH, dir));
            this.genNodeMine(x, y, z, this.wrapRotation(DIRECTION.EAST, dir));
            this.genNodeMine(x, y, z, this.wrapRotation(DIRECTION.WEST, dir));
        }

        let node = this.findNodeMine(new_x, new_y, new_z);
        if (node != null) {
            return;
        }

        if (this.random.double() < this.chance_cross) {
            this.addNode(new_x, new_y, new_z, dir, 'cross');
            this.genNodeMine(new_x, new_y, new_z, this.wrapRotation(DIRECTION.NORTH, dir));
            this.genNodeMine(new_x, new_y, new_z, this.wrapRotation(DIRECTION.EAST, dir));
            this.genNodeMine(new_x, new_y, new_z, this.wrapRotation(DIRECTION.WEST, dir));
            return;
        }

        if (this.random.double() < this.chance_hal) {
            this.addNode(new_x, new_y, new_z, dir, 'hal');
            this.genNodeMine(new_x, new_y, new_z, this.wrapRotation(DIRECTION.NORTH, dir));
            return;
        }

        if (this.random.double() < this.chance_side_room) {
            this.addNode(new_x, new_y, new_z, dir, 'room');
        }

    }

    // Generate chunk blocks
    fillBlocks(chunk) {

        if(this.is_empty) {
            return false;
        }

        let aabb = new AABB();

        aabb.x_min = (chunk.coord.x - this.coord.x) / NODE_SIZE.x;
        aabb.z_min = (chunk.coord.z - this.coord.z) / NODE_SIZE.z;
        aabb.x_max = aabb.x_min;
        aabb.z_max = aabb.z_min;
        aabb.y_max = NODE_COUNT.y;

        for(let [_, node] of this.nodes.entries(aabb)) {
            if (node.type == "enter") {
                this.genNodeEnter(chunk, node);
            } else if (node.type == "cross") {
                this.genNodeCross(chunk, node);
            } else if (node.type == "hal") {
                this.genNodeHal(chunk, node);
            } else if (node.type == "room") {
                this.genNodeSideRoom(chunk, node);
            }
        }

        return true;

    }

    // Generate sideroom node
    genNodeSideRoom(chunk, node) {

        const dir = node.dir;

        this.genBox(chunk, node, 0, 0, 0, 9, 1, 4, dir, BLOCK.BRICKS);
        this.genBox(chunk, node, 0, 2, 0, 9, 3, 4, dir, BLOCK.BRICKS);
        this.genBox(chunk, node, 1, 1, 1, 8, 3, 4, dir);

        let vec = new Vector$1(0, 0, 0);
        vec.set(8, 3, 4).rotY(dir);
        this.setBlock(chunk, node, vec.x, vec.y, vec.z, BLOCK.LANTERN, true, LANTERN_ROT_UP);

        vec.set(1, 1, 1).rotY(dir);
        const chest_rot = CHEST_ROT;
        this.setBlock(chunk, node, vec.x, vec.y, vec.z, BLOCK.CHEST, true, chest_rot, {generate: true, params: {source: 'cave_mines'}});
    }

    // Generate enter node
    genNodeEnter(chunk, node) {
        const dir = node.dir;
        this.genBox(chunk, node, 0, 1, 8, 15, 3, 15, dir);
        this.genBox(chunk, node, 0, 0, 0, 15, 0, 15, dir, BLOCK.OAK_PLANK);

        const addFloorDecor = (vec, block) => {
            let temp_block_over = this.getBlock(chunk, node, vec.x, vec.y + 1, vec.z);
            // block must connected to other block (not air)
            if(temp_block_over && temp_block_over.id != 0) {
                this.setBlock(chunk, node, vec.x, vec.y, vec.z, block, true, LANTERN_ROT_UP);
            }
        };

        let vec = new Vector$1(0, 0, 0);
        if(node.random.double() < .5) addFloorDecor(vec.set(15, 3, 15).rotY(dir), BLOCK.LANTERN);
        if(node.random.double() < .5) addFloorDecor(vec.set(0, 3, 15).rotY(dir), BLOCK.LANTERN);
        if(node.random.double() < .5) addFloorDecor(vec.set(0, 3, 8).rotY(dir), BLOCK.LANTERN);
        if(node.random.double() < .5) addFloorDecor(vec.set(15, 3, 8).rotY(dir), BLOCK.LANTERN);

    }

    // Generate cross node
    genNodeCross(chunk, node) {
        const dir = node.dir;
        this.genBox(chunk, node, 0, 1, 0, 4, 4, 15, dir, BLOCK.AIR, 0.05);

        this.genBox(chunk, node, 0, 1, 1, 1, 3, 3, dir);
        this.genBox(chunk, node, 1, 1, 0, 3, 3, 15, dir);
        this.genBox(chunk, node, 1, 1, 12, 15, 3, 14, dir);

        // floor as bridge over air
        this.genBox(chunk, node, 1, 0, 0, 3, 0, 15, dir, BLOCK.OAK_PLANK, 1, true);
        this.genBox(chunk, node, 1, 0, 12, 15, 0, 14, dir, BLOCK.OAK_PLANK, 1, true);
        this.genBox(chunk, node, 0, 0, 1, 1, 0, 3, dir, BLOCK.OAK_PLANK, 1, true);

        let interval = Math.round(node.random.double()) + 4;

        for (let n = 0; n < 16; n += interval) {

            if(n == 0) {
                continue;
            }

            // опоры
            this.genBox(chunk, node, 1, 1, n, 1, 2, n, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, node, 3, 1, n, 3, 2, n, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, node, 1, 3, n, 3, 3, n, dir, BLOCK.OAK_PLANK);

            this.genBox(chunk, node, n, 1, 14, n, 2, 14, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, node, n, 1, 12, n, 2, 12, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, node, n, 3, 12, n, 3, 14, dir, BLOCK.OAK_PLANK);

            const sign = dir % 2 == 1 ? -1 : 1;
            let torch_dir = dir + 1 * sign;
            this.genBox(chunk, node, n + 1, 3, 13, n + 1, 3, 13, dir, BLOCK.TORCH, .3, false, {x: torch_dir % 4, y: 0, z: 0});
            this.genBox(chunk, node, n - 1, 3, 13, n - 1, 3, 13, dir, BLOCK.TORCH, .3, false, {x: (torch_dir + 2) % 4, y: 0, z: 0});

            // паутина
            this.genBoxAir(chunk, node, 1, 3, n - 3, 1, 3, n + 3, dir, BLOCK.COBWEB, 0.05);
            this.genBoxAir(chunk, node, 3, 3, n - 3, 3, 3, n + 3, dir, BLOCK.COBWEB, 0.05);

            this.genBoxAir(chunk, node, n - 3, 3, 14, n + 3, 3, 14, dir, BLOCK.COBWEB, 0.05);
            this.genBoxAir(chunk, node, n - 3, 3, 12, n + 3, 3, 12, dir, BLOCK.COBWEB, 0.05);

            // факелы
            this.genBoxAir(chunk, node, 1, 3, n - 3, 1, 3, n + 3, dir, BLOCK.LANTERN, LANTERN_CHANCE * 2, LANTERN_ROT_UP);
            this.genBoxAir(chunk, node, 3, 3, n - 3, 3, 3, n + 3, dir, BLOCK.COBWEB, 0.1, LANTERN_ROT_UP);

            this.genBoxAir(chunk, node, n - 3, 3, 14, n + 3, 3, 14, dir, BLOCK.LANTERN, LANTERN_CHANCE, LANTERN_ROT_UP);
            this.genBoxAir(chunk, node, n - 3, 3, 12, n + 3, 3, 12, dir, BLOCK.LANTERN, LANTERN_CHANCE * 2, LANTERN_ROT_UP);
        }
    }

    // Generate hal node
    genNodeHal(chunk, node) {
        const dir = node.dir;

        this.genBox(chunk, node, 0, 1, 0, 4, 4, 15, dir, BLOCK.AIR, 0.05);
        this.genBox(chunk, node, 1, 1, 0, 3, 3, 15, dir);

        // floor
        this.genBox(chunk, node, 1, 0, 0, 3, 0, 15, dir, BLOCK.OAK_PLANK, 1, true);

        let interval = Math.round(node.random.double()) + 4;
        for (let n = 0; n <= 15; n += interval) {

            if(n == 0) {
                continue;
            }

            this.genBox(chunk, node, 1, 1, n, 1, 2, n, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, node, 3, 1, n, 3, 2, n, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, node, 1, 3, n, 3, 3, n, dir, BLOCK.OAK_PLANK);

            this.genBoxNoAir(chunk, node, 1, 3, n, 3, 3, n, dir, BLOCK.OAK_PLANK, 0.25);

            this.genBoxAir(chunk, node, 1, 3, n - 1, 1, 3, n + 1, dir, BLOCK.COBBLESTONE, 0.25); // добавить из окружения
            this.genBoxAir(chunk, node, 3, 3, n - 1, 3, 3, n + 1, dir, BLOCK.DIRT, 0.25);

            // паутина
            this.genBoxAir(chunk, node, 1, 3, n - 3, 1, 3, n + 3, dir, BLOCK.COBWEB, 0.05);
            this.genBoxAir(chunk, node, 3, 3, n - 3, 3, 3, n + 3, dir, BLOCK.COBWEB, 0.05);

            // грибы
            this.genBoxAir(chunk, node, 1, 1, n - 3, 1, 1, n + 3, dir, BLOCK.BROWN_MUSHROOM, 0.01);
            this.genBoxAir(chunk, node, 3, 1, n - 3, 3, 1, n + 3, dir, BLOCK.BROWN_MUSHROOM, 0.01);

            // факел
            this.genBoxAir(chunk, node, 3, 3, n - 3, 3, 3, n + 3, dir, BLOCK.LANTERN, LANTERN_CHANCE, LANTERN_ROT_UP);
            this.genBoxAir(chunk, node, 1, 3, n - 3, 1, 3, n + 3, dir, BLOCK.LANTERN, LANTERN_CHANCE, LANTERN_ROT_UP);
        }
    }

    // Add new node
    addNode(x, y, z, dir, type) {
        let add_bottom_y = this.random.double() >= .5 ? 1 : 0;
        const bottom_y = y * NODE_SIZE.y + add_bottom_y;
        const random = new impl(`node_mine_${x}_${y}_${z}`);
        this.nodes.set(new Vector$1(x, y, z), {dir, type, random, bottom_y});
    }

    findNodeMine(x, y, z) {
        return this.nodes.get(this._get_vec.set(x, y, z)) || null;
    }

    setBlock(chunk, node, x, y, z, block_type, force_replace, rotate, extra_data) {
        y += node.bottom_y;

        const { tblocks } = chunk;
        if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
            if(force_replace || !tblocks.getBlockId(x, y, z)) {
                this.xyz_temp_coord.set(x, y, z).addSelf(chunk.coord);
                if(!this.generator.getVoxelBuilding(this.xyz_temp_coord)) {
                    tblocks.setBlockId(x, y, z, block_type.id);
                    if(rotate || extra_data) {
                        tblocks.setBlockRotateExtra(x, y, z, rotate, extra_data);
                    }
                }
            }
        }
    }

    getBlock(chunk, node, x, y, z) {
        y += node.bottom_y;
        if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
            let xyz = new Vector$1(x, y, z);
            return chunk.tblocks.get(xyz);
        }
    }

    wrapRotation(dir, angle) {
        let new_dir = dir - angle;
        if (new_dir == -1) {
            new_dir = 3;
        } else if (new_dir == -2) {
            new_dir = 2;
        }
        return new_dir;
    }

    /**
     * TO DO EN генерация бокса внутри чанка, генерация с вероятностью установки
     * @param {Chunk} chunk
     * @param {number} minX
     * @param {number} minY
     * @param {number} minZ
     * @param {number} maxX
     * @param {number} maxY
     * @param {number} maxZ
     * @param {Block} block
     * @param {DIRECTION} dir поворот внутри чанка
     * @param {float} chance вероятность установки
     * @param {bool} only_if_air только если на позиции блок воздуха
     * @param {Vector} block_rotate поворот блока
     */
    genBox(chunk, node, minX, minY, minZ, maxX, maxY, maxZ, dir = DIRECTION.NORTH, blocks = {id : 0}, chance = 1, only_if_air = false, block_rotate = null) {
        for (let x = minX; x <= maxX; ++x) {
            for (let y = minY; y <= maxY; ++y) {
                for (let z = minZ; z <= maxZ; ++z) {
                    let is_chance = (chance == 1) ? true : node.random.double() < chance;
                    if (is_chance) {
                        let vec = (new Vector$1(x, y, z)).rotY(dir);
                        if(only_if_air) {
                            let temp_block = this.getBlock(chunk, node, vec.x, vec.y, vec.z);
                            if(temp_block.id != 0) {
                                continue;
                            }
                        }
                        this.setBlock(chunk, node, vec.x, vec.y, vec.z, blocks, true, block_rotate);
                    }
                }
            }
        }
    }

    /**
     * TO DO EN замена воздуха на блок с вероятностью
     * @param {Chunk} chunk
     * @param {number} minX
     * @param {number} minY
     * @param {number} minZ
     * @param {number} maxX
     * @param {number} maxY
     * @param {number} maxZ
     * @param {Block} block
     * @param {DIRECTION} dir поворот внутри чанка
     * @param {float} chance вероятность замены
     * @param {Vector} block_rotate поворот блока
     */
    genBoxAir(chunk, node, minX, minY, minZ, maxX, maxY, maxZ, dir = DIRECTION_BIT.NORTH, block = {id : 0}, chance = 1, block_rotate = null) {
        for (let x = minX; x <= maxX; ++x) {
            for (let y = minY; y <= maxY; ++y) {
                for (let z = minZ; z <= maxZ; ++z) {
                    let vec = (new Vector$1(x, y, z)).rotY(dir);
                    let temp_block = this.getBlock(chunk, node, vec.x, vec.y, vec.z);
                    let temp_block_over = this.getBlock(chunk, node, vec.x, vec.y + 1, vec.z);
                    // block must connected to other block (not air)
                    if(temp_block_over && temp_block_over.id != 0) {
                        let is_chance = (chance == 1) ?  true : node.random.double() < chance;
                        if (is_chance == true && temp_block != null && temp_block.id == 0) {
                            this.setBlock(chunk, node, vec.x, vec.y, vec.z, block, true, block_rotate);
                        }
                    }
                }
            }
        }
    }

    /**
     * TO DO EN замена не воздуха на блок с вероятностью
     * @param {Chunk} chunk
     * @param {number} minX
     * @param {number} minY
     * @param {number} minZ
     * @param {number} maxX
     * @param {number} maxY
     * @param {number} maxZ
     * @param {Block} block
     * @param {DIRECTION} dir поворот внутри чанка
     * @param {float} chance вероятность замены
     */
    genBoxNoAir(chunk, node, minX, minY, minZ, maxX, maxY, maxZ, dir = DIRECTION_BIT.NORTH, block = {id : 0}, chance = 1) {
        for (let x = minX; x <= maxX; ++x) {
            for (let y = minY; y <= maxY; ++y) {
                for (let z = minZ; z <= maxZ; ++z) {
                    let vec = (new Vector$1(x, y, z)).rotY(dir);
                    let temp_block = this.getBlock(chunk, node, vec.x, vec.y, vec.z);
                    let is_chance = (chance == 1) ?  true : node.random.double() < chance;
                    if (is_chance == true && temp_block != null && temp_block.id != 0) {
                        this.setBlock(chunk, node, vec.x, vec.y, vec.z, block, true);
                    }
                }
            }
        }
    }

}

// Общее количество блоков в чанке
const DIVIDER                   = new Vector$1(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);
const CHUNK_DIAGONAL_LENGTH     = Vector$1.ZERO.distance(DIVIDER);
const MAX_RAD                   = 2; // максимальный радиус секции
const TREASURE_ROOM_RAD         = 3.5;
const GROUP_COUNT               = 8;
const MAX_DIR_LENGTH            = 25;
const CAVES_SERCH_MARGIN        = 8;
const CAVES_MAX_LENGTH          = CAVES_SERCH_MARGIN * CHUNK_SIZE_X - (MAX_RAD + 1) * 2;
const _aabb                     = new AABB();
const _intersection$1             = new Vector$1(0, 0, 0);
const temp_vec                  = new Vector$1(0, 0, 0);
const vec_line                  = new Vector$1(0, 0, 0);
const new_pos                   = new Vector$1(0, 0, 0);
const _vec_chunk_start          = new Vector$1(0, 0, 0); // Адрес чанка, где начинается отрезок
const _vec_chunk_end            = new Vector$1(0, 0, 0); // Адрес чанка, где заканчивается отрезок
const _vec_chunk_coord          = new Vector$1(0, 0, 0); //

/*
//
const side              = new Vector(0, 0, 0);
const coord             = ['x', 'y', 'z'];
const INF               = 100000.0;
const eps               = 1e-3;
const _block_vec        = new Vector(0, 0, 0);
const _pos              = new Vector(0, 0, 0);
const vc_trace          = new VectorCollector();
const pos               = new Vector(0, 0, 0);
const pos2              = new Vector(0, 0, 0);

// traceVec3
function traceVec3(p1, p2) {

    pos.copyFrom(p1);
    pos2.copyFrom(p2);

    const pickat_distance   = p1.distance(p2);
    const dir               = p2.sub(p1).normalize();
    const block             = _block_vec.copyFrom(p1);

    vc_trace.clear();

    while (Math.abs(block.x - p1.x) < pickat_distance
        && Math.abs(block.y - p1.y) < pickat_distance
        && Math.abs(block.z - p1.z) < pickat_distance
    ) {
        let tMin = INF;
        for(let d of coord) {
            if(dir[d] > eps && tMin > (block[d]  - pos[d]) / dir[d]) {
                tMin = (block[d] - pos[d]) / dir[d];
                side.zero()[d] = 1;
            }
            if(dir[d] < -eps && tMin > (block[d] - pos[d]) / dir[d]) {
                tMin = (block[d] - pos[d]) / dir[d];
                side.zero()[d] = -1;
            }
        }

        if (tMin >= INF) {
            break;
        }

        pos.x += dir.x * tMin;
        pos.y += dir.y * tMin;
        pos.z += dir.z * tMin;

        for(let x = -1; x <= 1; x++) {
            for(let y = -1; y <= 1; y++) {
                for(let z = -1; z <= 1; z++) {
                    _pos.set(x, y, z).addSelf(pos).flooredSelf();
                    if(_pos.x>=p1.x && _pos.y>=p1.y && _pos.z>=p1.z) {
                        if(_pos.x<=p2.x && _pos.y<=p2.y && _pos.z<=p2.z) {
                            vc_trace.set(_pos, true);
                        }
                    }
                }
            }
        }

        if(pos.equal(p2)) {
            break;
        }

        block.addSelf(side);

    }

    return Array.from(vc_trace.keys());

}
*/

// CaveLine...
class CaveLine {

    constructor(p_start, p_end, rad, aabb) {
        this.p_start = p_start;
        this.p_end = p_end;
        this.rad = rad;
        this.aabb = aabb;
    }

}

// Cave...
class Cave {

    static generateLines(lines, addr, aleaRandom) {

        // Генерируем абсолютную позицию начала пещеры в этом чанке
        let index = parseInt(aleaRandom.double() * CHUNK_SIZE * .7);

        // Конвертируем позицию в 3D вектор
        const x = index % CHUNK_SIZE_X;
        const y = index / (CHUNK_SIZE_X * CHUNK_SIZE_Z) | 0;
        const z = ((index) % (CHUNK_SIZE_X * CHUNK_SIZE_Z) - x) / CHUNK_SIZE_X;
        vec_line.set(x, y, z);

        const start_coord = addr.mul(DIVIDER).addSelf(vec_line); //
        let p_start = start_coord.clone();

        // getChunk
        function getChunk(addr) {
            let chunk = lines.get(addr);
            if(!chunk) {
                chunk = {list: []};
                lines.set(addr, chunk);
            }
            return chunk;
        }

        vec_line.x = Infinity;

        let r = aleaRandom.double();
        const length = Math.round(r * MAX_DIR_LENGTH) + 1;
        const vert_coeff = 2;
        let p_end = null;

        let is_treasure = r < .22;

        // Генерация групп(по умолчанию 3 штуки) секций("тела") пещеры
        for(let i = 0; i < GROUP_COUNT; i++) {

            let rad = Math.round(aleaRandom.double() * MAX_RAD) + 1;

            if(vec_line.x == Infinity) {
                // Генерация нового направления группы секций
                if(is_treasure) {
                    rad = TREASURE_ROOM_RAD;
                    vec_line.set(8, 0, 0).flooredSelf();
                } else {
                    vec_line.set(
                        (aleaRandom.double() * 2 - 1) * length,
                        (aleaRandom.double() * 2 - 1) * (length / vert_coeff),
                        (aleaRandom.double() * 2 - 1) * length
                    ).flooredSelf();
                }
                p_end = p_start.add(vec_line);
            } else {
                new_pos.copyFrom(p_end).addSelf(vec_line);
                const max_rad = new_pos.distance(p_end) * .9;
                new_pos.x += (aleaRandom.double() * 2 - 1) * max_rad;
                new_pos.y += (aleaRandom.double() * 2 - 1) * (max_rad / vert_coeff);
                new_pos.z += (aleaRandom.double() * 2 - 1) * max_rad;
                p_end.set(new_pos).flooredSelf();
            }

            //
            const dist_from_start = start_coord.distance(p_end);
            if(dist_from_start > CAVES_MAX_LENGTH) {
                // console.log('break cave', dist, addr.toHash());
                break;
            }

            // Для расчетов максимально разнесенных точек отрезка с учетом радиуса
            _aabb.set(Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity);
            _aabb.addPoint(p_start.x - rad, p_start.y - rad, p_start.z - rad);
            _aabb.addPoint(p_start.x + rad, p_start.y + rad, p_start.z + rad);
            _aabb.addPoint(p_end.x - rad, p_end.y - rad, p_end.z - rad);
            _aabb.addPoint(p_end.x + rad, p_end.y + rad, p_end.z + rad);

            // Вычисляем начальный и конечный чанк для крайних блоков капсули отрезка
            _vec_chunk_start.set(_aabb.x_min, _aabb.y_min, _aabb.z_min).divScalarVec(DIVIDER).flooredSelf();
            _vec_chunk_end.set(_aabb.x_max, _aabb.y_max, _aabb.z_max).divScalarVec(DIVIDER).flooredSelf();

            // Отрезок
            const line = new CaveLine(p_start.clone(), p_end.clone(), rad, _aabb.clone());
            line.is_treasure = is_treasure;
            line.r = aleaRandom.double();
            is_treasure = false;

            // Если отрезок полностью умещается в одном чанке
            if(_vec_chunk_start.equal(_vec_chunk_end)) {
                let chunk = getChunk(_vec_chunk_start);
                chunk.list.push(line);
            } else {
                for(let x = _vec_chunk_start.x; x <= _vec_chunk_end.x; x++) {
                    for(let y = _vec_chunk_start.y; y <= _vec_chunk_end.y; y++) {
                        for(let z = _vec_chunk_start.z; z <= _vec_chunk_end.z; z++) {
                            temp_vec.set(x, y, z);
                            _vec_chunk_coord.set(
                                x * CHUNK_SIZE_X + (CHUNK_SIZE_X / 2),
                                y * CHUNK_SIZE_Y + (CHUNK_SIZE_Y / 2),
                                z * CHUNK_SIZE_Z + (CHUNK_SIZE_Z / 2)
                            );
                            let dist = _vec_chunk_coord.distanceToLine(line.p_start, line.p_end, _intersection$1);
                            if(dist <= CHUNK_DIAGONAL_LENGTH / 2) {
                                let chunk = getChunk(temp_vec);
                                chunk.list.push(line);
                            }
                        }
                    }
                }
            }

            p_start = p_end.clone();
            // @todo В редких случаях генерируем высокие пещеры

        }

    }

}

// CaveGenerator...
class CaveGenerator {

    constructor(seed) {
        this.seed           = typeof seed != 'undefined' ? seed : 'default_seed'; // unique world seed
        this.margin         = CAVES_SERCH_MARGIN;
        this.spiral_moves   = SpiralGenerator.generate3D(new Vector$1(this.margin, this.margin, this.margin));
        this.lines          = new VectorCollector(); // В ключах адреса чанков, в значениях отрезки, которые затрагивают этот чанк
        this.caves          = new VectorCollector(); // Чтобы не генерировать пещеры в одних и техже чанках много раз подряд
        this._temp_add_vec  = new Vector$1(0, 0, 0);
        this._neighb        = new Vector$1(0, 0, 0);
    }

    // add
    add(chunk_addr) {

        if(chunk_addr.y < 0 || chunk_addr.y > 2) {
            return false;
        }

        if(!this.caves.has(chunk_addr)) {
            const aleaRandom = new impl(this.seed + chunk_addr.toString());
            if(aleaRandom.double() < .7) {
                this.caves.set(chunk_addr, true);
                return true;
            }
            Cave.generateLines(this.lines, chunk_addr, aleaRandom);
            this.caves.set(chunk_addr, true);
            return true;
        }
        return false;
    }

    /**
     * getNeighbourLines
     * @param { Vector } chunk_addr
     * @returns
     */
     getNeighbourLines(chunk_addr) {
        return this.lines.get(chunk_addr);
    }

    // Инициализация пещер во всех чанках вокруг центрального chunk_addr
    addSpiral(chunk_addr) {
        for (let i = 0; i < this.spiral_moves.length; i++) {
            const sm = this.spiral_moves[i];
            this._temp_add_vec.set(chunk_addr.x, chunk_addr.y, chunk_addr.z).addSelf(sm.pos);
            this.add(this._temp_add_vec);
        }
    }

}

const DEFAULT_CHEST_ROTATE = new Vector$1(3, 1, 0);

// Ores
const ORE_RANDOMS = [];
    

const sides = [
    new Vector$1(1, 0, 0),
    new Vector$1(-1, 0, 0),
    new Vector$1(0, 1, 0),
    new Vector$1(0, -1, 0),
    new Vector$1(0, 0, 1),
    new Vector$1(0, 0, -1)
];

const rotates = [
    new Vector$1(CubeSym.ROT_Z, 0, 0),
    new Vector$1(CubeSym.ROT_Z3, 0, 0),
    new Vector$1(CubeSym.NEG_Y, 0, 0),
    new Vector$1(CubeSym.ROT_Y3, 0, 0),
    new Vector$1(CubeSym.ROT_X, 0, 0),
    new Vector$1(CubeSym.ROT_X3, 0, 0)
];

// Randoms
let randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a = new impl('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

//
const vox_templates$1             = {};
const ppos                      = new Vector$1(0, 0, 0);
const _intersection             = new Vector$1(0, 0, 0);

//
const ABS_CONCRETE              = 16;
const MOSS_HUMIDITY             = .75;
const AMETHYST_ROOM_RADIUS      = 6;
const AMETHYST_CLUSTER_CHANCE   = 0.1;

// Terrain generator class
class Terrain_Generator$4 extends Default_Terrain_Generator {

    constructor(seed, world_id, options) {
        super(seed, world_id, options);
        this._createBlockAABB = new AABB();
        this._createBlockAABB_second = new AABB();
        this.temp_set_block = null;
        this.OCEAN_BIOMES = ['OCEAN', 'BEACH', 'RIVER'];
        if(ORE_RANDOMS.length == 0) {
            ORE_RANDOMS.push(...[
                {max_rad: 2, block_id: BLOCK$1.DIAMOND_ORE.id, max_y: 32},
                {max_rad: 2, block_id: BLOCK$1.GOLD_ORE.id, max_y: Infinity},
                {max_rad: 2, block_id: BLOCK$1.REDSTONE_ORE.id, max_y: Infinity},
                {max_rad: 2, block_id: BLOCK$1.IRON_ORE.id, max_y: Infinity},
                {max_rad: 2, block_id: BLOCK$1.IRON_ORE.id, max_y: Infinity},
                {max_rad: 1, block_id: BLOCK$1.IRON_ORE.id, max_y: Infinity},
                {max_rad: 1, block_id: BLOCK$1.IRON_ORE.id, max_y: Infinity},
                {max_rad: 2, block_id: BLOCK$1.COAL_ORE.id, max_y: Infinity},
                {max_rad: 2, block_id: BLOCK$1.COAL_ORE.id, max_y: Infinity},
                {max_rad: 2, block_id: BLOCK$1.COAL_ORE.id, max_y: Infinity},
                {max_rad: 3, block_id: BLOCK$1.COAL_ORE.id, max_y: Infinity},
                {max_rad: 3, block_id: BLOCK$1.COAL_ORE.id, max_y: Infinity},
                {max_rad: 3, block_id: BLOCK$1.COAL_ORE.id, max_y: Infinity}
            ]);
        }
    }

    async init() {
        // Настройки
        this.options                = {...GENERATOR_OPTIONS, ...this.options};
        this.temp_vec               = new Vector$1(0, 0, 0);
        this.noise3d                = noise.simplex3;
        //
        this.noisefn                = noise.perlin2;
        this.noisefn3d              = noise.perlin3;
        // Сaves manager
        this.caveManager            = new CaveGenerator(this.seed);
        this.islands                = [];
        this.extruders              = [];
        //
        this.maps                   = new TerrainMapManager(this.seed, this.world_id, this.noisefn);
        // Map specific
        if(this.world_id == 'demo') {
            await this.generateDemoMapStructures();
        }
    }

    // Map specific
    async generateDemoMapStructures() {
        // Костыль для NodeJS
        let root_dir = '../www';
        if(typeof process === 'undefined') {
            root_dir = '';
        }
        await Vox_Loader.load(root_dir + '/data/vox/monu10.vox', (chunks) => {
            let palette = {
                81: BLOCK$1.CONCRETE,
                97: BLOCK$1.OAK_PLANK,
                121: BLOCK$1.STONE_BRICK,
                122: BLOCK$1.SMOOTH_STONE,
                123: BLOCK$1.GRAVEL,
            };
            vox_templates$1.monu10 = {chunk: chunks[0], palette: palette};
        });
        await Vox_Loader.load(root_dir + '/data/vox/castle.vox', (chunks) => {
            let palette = {
                93: BLOCK$1.GRAVEL,
                106: BLOCK$1.STONE_BRICK,
                114: BLOCK$1.CONCRETE,
                72: BLOCK$1.GRASS_DIRT,
                235: BLOCK$1.POWDER_SNOW,
                54: BLOCK$1.SPRUCE_PLANK,
                150: BLOCK$1.OAK_LEAVES,
                139: BLOCK$1.OAK_LEAVES,
                58: BLOCK$1.OAK_TRUNK,
                107: BLOCK$1.GRASS_DIRT,
                144: BLOCK$1.OAK_LEAVES,
                143: BLOCK$1.GRASS_DIRT,
                253: BLOCK$1.OAK_PLANK,
                238: BLOCK$1.SPRUCE_PLANK,
                79: BLOCK$1.BIRCH_PLANK,
                184: BLOCK$1.GRASS_DIRT,
                174: BLOCK$1.GRASS_DIRT,
            };
            vox_templates$1.castle = {chunk: chunks[0], palette: palette};
        });
        this.voxel_buildings.push(new Vox_Mesh(vox_templates$1.monu10, new Vector$1(2840, 58, 2830), new Vector$1(0, 0, 0), null, null));
        this.voxel_buildings.push(new Vox_Mesh(vox_templates$1.castle, new Vector$1(2980, 70, 2640), new Vector$1(0, 0, 0), null, new Vector$1(0, 1, 0)));
        this.islands.push({
            pos: new Vector$1(2865, 118, 2787),
            rad: 15
        });
        this.islands.push({
            pos: new Vector$1(2920, 1024, 2787),
            rad: 20
        });
        this.extruders.push({
            pos: this.islands[0].pos.sub(new Vector$1(0, 50, 0)),
            rad: this.islands[0].rad
        });
    }

    // getOreBlockID...
    getOreBlockID(map, xyz, value, dirt_block) {
        this.temp_vec.copyFrom(xyz);
        this.temp_vec.y++;
        if(map.plants.has(this.temp_vec)) {
            return dirt_block;
        }
        let stone_block_id = BLOCK$1.CONCRETE.id;
        let density = this.noise3d(xyz.x / 20, xyz.z / 20, xyz.y / 20) / 2 + .5;
        if(density > 0.5) {
            if(density < 0.66) {
                stone_block_id = BLOCK$1.DIORITE.id;
            } else if(density < 0.83) {
                stone_block_id = BLOCK$1.ANDESITE.id;
            } else {
                stone_block_id = BLOCK$1.GRANITE.id;
            }
        } else if(xyz.y < value - 5) {
            for (let i = 0; i < this.ores.length; i++) {
                const ore = this.ores[i];
                if(ore.pos.distance(xyz) < ore.rad) {
                    if(xyz.y < ore.max_y) {
                        stone_block_id = ore.block_id;
                    }
                    break;
                }
            }
        }
        return stone_block_id;
    }

    // Generate
    generate(chunk) {

        let xyz                         = new Vector$1(0, 0, 0);
        let temp_vec                    = new Vector$1(0, 0, 0);
        const seed                      = chunk.id;
        const aleaRandom                = new impl(seed);
        const size_x                    = chunk.size.x;
        const size_y                    = chunk.size.y;
        const size_z                    = chunk.size.z;

        // Maps
        let maps                        = this.maps.generateAround(chunk, chunk.addr, true, true);
        let map                         = maps[4];
        const cluster                   = chunk.cluster;
        const ywl                       = map.options.WATER_LINE - chunk.coord.y;

        this.caveManager.addSpiral(chunk.addr);

        // Ores
        // @todo для каждого блока в чанке считается расстояние до каждого источника руды
        this.ores = [];
        const margin = 3;
        let count = Math.round(aleaRandom.double() * 15);
        for(let i = 0; i < count; i++) {
            const r = Math.floor(aleaRandom.double() * ORE_RANDOMS.length);
            const ore = ORE_RANDOMS[r];
            ore.rad = Math.min(Math.round(aleaRandom.double() * ore.max_rad) + 1, ore.max_rad),
            ore.pos = new Vector$1(
                margin + (CHUNK_SIZE_X - margin*2) * aleaRandom.double(),
                margin + (CHUNK_SIZE_Y - margin*2) * aleaRandom.double(),
                margin + (CHUNK_SIZE_Z - margin*2) * aleaRandom.double()
            ).flooredSelf().addSelf(chunk.coord);
            this.ores.push(ore);
        }

        // Endless caves / Бесконечные пещеры нижнего уровня
        if(chunk.addr.y < -1) {

            this.generateBottomCaves(chunk, aleaRandom);

        } else {

            const neighbour_lines = this.caveManager.getNeighbourLines(chunk.addr);

            const has_chunk_cave_lines = neighbour_lines && neighbour_lines.list.length > 0;
            const has_voxel_buildings = this.intersectChunkWithVoxelBuildings(chunk.aabb);
            const has_islands = this.intersectChunkWithIslands(chunk.aabb);
            const has_extruders = this.intersectChunkWithExtruders(chunk.aabb);
            const has_spiral_staircaes = this.world_id == 'demo' && chunk.addr.x == 180 && chunk.addr.z == 174;

            if(has_spiral_staircaes) {
                this.drawSpiralStaircases(chunk);
            }

            //
            for(let x = 0; x < size_x; x++) {
                for(let z = 0; z < size_z; z++) {

                    const cell              = map.cells[z * CHUNK_SIZE_X + x];
                    const biome             = cell.biome;
                    const value             = cell.value2;
                    const rnd               = aleaRandom.double();
                    const local_dirt_level  = value - (rnd < .005 ? 1 : 3);
                    const in_ocean          = this.OCEAN_BIOMES.indexOf(biome.code) >= 0;
                    const dirt_block        = cell.dirt_block_id;
                    const has_ocean_blocks  = biome.code == 'OCEAN' && ywl >= 0;

                    xyz.set(x + chunk.coord.x, chunk.coord.y, z + chunk.coord.z);

                    if(!has_ocean_blocks && !has_voxel_buildings && !has_islands && !has_extruders && chunk.coord.y > value) {
                        continue;
                    }

                    for(let y = 0; y < size_y; y++) {

                        xyz.y = chunk.coord.y + y;
                        // xyz.set(x + chunk.coord.x, y + chunk.coord.y, z + chunk.coord.z);

                        // Draw voxel buildings
                        if(has_voxel_buildings && this.drawBuilding(xyz, x, y, z, chunk)) {
                            continue;
                        }

                        // Islands
                        if(has_islands && this.drawIsland(xyz, x, y, z, chunk)) {
                            continue;
                        }

                        // Remove volume from terrain
                        if(has_extruders && this.extrude(xyz)) {
                            continue;
                        }

                        // Exit
                        if(xyz.y >= value) {
                            continue;
                        }

                        // Caves | Пещеры
                        if(has_chunk_cave_lines && !in_ocean) {
                            const line = this.checkIsCaveBlock(xyz, neighbour_lines, value);
                            if(line) {
                                if(line.is_treasure) {
                                    this.drawTreasureRoom(chunk, line, xyz, x, y, z);
                                    continue;
                                } else if(!this.nearTree(chunk, xyz, value, cluster, maps)) {
                                    continue;
                                }
                            }
                        }

                        // Ores (если это не вода, то заполняем полезными ископаемыми)
                        let block_id = dirt_block;
                        if(xyz.y < local_dirt_level) {
                            block_id = this.getOreBlockID(map, xyz, value, dirt_block);
                        }
                        chunk.setBlockIndirect(x, y, z, block_id);

                    }

                    // `Y` of waterline
                    if(has_ocean_blocks) {
                        temp_vec.set(x, 0, z);
                        for(let y = value; y <= map.options.WATER_LINE; y++) {
                            if(y >= chunk.coord.y && y < chunk.coord.y + chunk.size.y) {
                                temp_vec.y = y - chunk.coord.y;
                                if(!chunk.tblocks.has(temp_vec)) {
                                    chunk.setBlockIndirect(temp_vec.x, temp_vec.y, temp_vec.z, BLOCK$1.STILL_WATER.id);
                                }
                            }
                        }
                        if(cell.equator < .6 && cell.humidity > .4) {
                            const vl = map.options.WATER_LINE;
                            if(vl >= chunk.coord.y && vl < chunk.coord.y + chunk.size.y) {
                                temp_vec.y = vl - chunk.coord.y;
                                chunk.setBlockIndirect(temp_vec.x, temp_vec.y, temp_vec.z, BLOCK$1.ICE.id);
                            }
                        }
                    }

                }
            }

            if(!chunk.cluster.is_empty) {
                chunk.cluster.fillBlocks(this.maps, chunk, map);
            }

            // Plant trees
            for (let i = 0; i < maps.length; i++) {
                const m = maps[i];
                for (let j = 0; j < m.trees.length; j++) {
                    const p = m.trees[j];
                    this.plantTree(
                        p,
                        chunk,
                        m.chunk.coord.x + p.pos.x - chunk.coord.x,
                        m.chunk.coord.y + p.pos.y - chunk.coord.y,
                        m.chunk.coord.z + p.pos.z - chunk.coord.z
                    );
                }
            }

            // Plant herbs
            let temp_block = null;
            let idx = 0;
            for(let pos of map.plants.keys()) {
                if(pos.y >= chunk.coord.y && pos.y < chunk.coord.y + CHUNK_SIZE_Y) {
                    let block = map.plants.get(pos);
                    const block_id = block.id;
                    const extra_data = block.extra_data || null;
                    xyz.set(pos.x, pos.y - chunk.coord.y - 1, pos.z);
                    temp_block = chunk.tblocks.get(xyz, temp_block);
                    if(temp_block.id === BLOCK$1.GRASS_DIRT.id || temp_block.id == 516 || temp_block.id == 11) {
                        temp_vec.set(pos.x, pos.y - chunk.coord.y, pos.z);
                        if(!chunk.tblocks.has(temp_vec)) {
                            if(idx++ % 7 == 0 && temp_vec.y < CHUNK_SIZE_Y - 2 && block_id == BLOCK$1.GRASS.id) {
                                // check over block
                                xyz.y += 2;
                                temp_block = chunk.tblocks.get(xyz, temp_block);
                                if(temp_block.id == 0) {
                                    //
                                    chunk.setBlockIndirect(temp_vec.x, temp_vec.y, temp_vec.z, BLOCK$1.TALL_GRASS.id);
                                    chunk.setBlockIndirect(temp_vec.x, temp_vec.y + 1, temp_vec.z, BLOCK$1.TALL_GRASS_TOP.id);
                                } else {
                                    chunk.setBlockIndirect(temp_vec.x, temp_vec.y, temp_vec.z, block_id, null, extra_data);
                                }
                            } else {
                                chunk.setBlockIndirect(temp_vec.x, temp_vec.y, temp_vec.z, block_id, null, extra_data);
                            }
                        }
                    }
                }
            }

        }

        if(chunk.addr.y == 0) {
            const mine = MineGenerator.getForCoord(this, chunk.coord);
            mine.fillBlocks(chunk);
        }

        return map;

    }

    // Генерация пещер нижнего мира
    generateBottomCaves(chunk, aleaRandom) {

        const noise3d               = noise.simplex3;
        let xyz                     = new Vector$1(0, 0, 0);
        let xyz_stone_density       = new Vector$1(0, 0, 0);
        let DENSITY_COEFF           = 1;
        let fill_count              = 0;

        const { cx, cy, cz, cw, tblocks } = chunk;
        //
        const getBlock = (x, y, z) => {
            const index = cx * x + cy * y + cz * z + cw;
            return tblocks.id[index];
        };

        //
        for(let x = 0; x < chunk.size.x; x++) {
            //if(chunk.coord.x + x < 2800) continue;

            for(let z = 0; z < chunk.size.z; z++) {

                //if(chunk.coord.z + z > 2900) continue;

                let y_start                 = Infinity;
                let stalactite_height       = 0;
                let stalactite_can_start    = false;
                let dripstone_allow         = true;

                for(let y = chunk.size.y - 1; y >= 0; y--) {

                    xyz.set(x + chunk.coord.x, y + chunk.coord.y, z + chunk.coord.z);

                    let density = (
                        noise3d(xyz.x / (100 * DENSITY_COEFF), xyz.y / (15 * DENSITY_COEFF), xyz.z / (100 * DENSITY_COEFF)) / 2 + .5 +
                        noise3d(xyz.x / (20 * DENSITY_COEFF), xyz.y / (20 * DENSITY_COEFF), xyz.z / (20 * DENSITY_COEFF)) / 2 + .5
                    ) / 2;

                    if(xyz.y > -ABS_CONCRETE) {
                        const dist = xyz.y / -ABS_CONCRETE + .2;
                        density += dist;
                    }

                    // air
                    if(density < 0.5) {
                        if(stalactite_can_start) {
                            const humidity = noise3d(xyz.x / 80, xyz.z / 80, xyz.y / 80) / 2 + .5;
                            if(y_start == Infinity) {
                                // start stalactite
                                y_start = y;
                                stalactite_height = 0;
                                // MOSS_BLOCK
                                if(humidity > MOSS_HUMIDITY) {
                                    chunk.setBlockIndirect(x, y + 1, z, BLOCK$1.MOSS_BLOCK.id);
                                    dripstone_allow = false;
                                }
                            } else {
                                stalactite_height++;
                                if(stalactite_height >= 5) {
                                    // Moss and vine
                                    if(humidity > MOSS_HUMIDITY) {
                                        if(stalactite_height == 5 + Math.round((humidity - MOSS_HUMIDITY) * (1 / MOSS_HUMIDITY) * 20)) {
                                            if(aleaRandom.double() < .3) {
                                                for(let yy = 0; yy < stalactite_height; yy++) {
                                                    let vine_id = null;
                                                    if(yy == stalactite_height - 1) {
                                                        vine_id = BLOCK$1.CAVE_VINE_PART3.id + (x + z + y + yy) % 2;
                                                    } else {
                                                        vine_id = BLOCK$1.CAVE_VINE_PART1.id + (aleaRandom.double() < .2 ? 1 : 0);
                                                    }
                                                    chunk.setBlockIndirect(x, y_start - yy, z, vine_id);
                                                }
                                            }
                                            // reset stalactite
                                            y_start = Infinity;
                                            stalactite_height = 0;
                                            stalactite_can_start = false;
                                        }
                                    } else if(dripstone_allow) {
                                        // Dripstone
                                        if(aleaRandom.double() < .3) {
                                            chunk.setBlockIndirect(x, y_start - 0, z, BLOCK$1.DRIPSTONE.id);
                                            chunk.setBlockIndirect(x, y_start - 1, z, BLOCK$1.DRIPSTONE2.id);
                                            chunk.setBlockIndirect(x, y_start - 2, z, BLOCK$1.DRIPSTONE3.id);
                                        }
                                        // reset stalactite
                                        y_start = Infinity;
                                        stalactite_height = 0;
                                        stalactite_can_start = false;
                                    }
                                }
                            }
                        }
                        continue;
                    }

                    let stone_block_id = BLOCK$1.CONCRETE.id;
                    xyz_stone_density.set(xyz.x + 100000, xyz.y + 100000, xyz.z + 100000);
                    let stone_density = noise3d(xyz_stone_density.x / 20, xyz_stone_density.z / 20, xyz_stone_density.y / 20) / 2 + .5;

                    if(stone_density < .025) {
                        stone_block_id = BLOCK$1.GLOWSTONE.id;
                    } else {
                        if(stone_density > 0.5) {
                            if(stone_density < 0.66) {
                                stone_block_id = BLOCK$1.DIORITE.id;
                            } else if(stone_density < 0.83) {
                                stone_block_id = BLOCK$1.ANDESITE.id;
                            } else {
                                stone_block_id = BLOCK$1.GRANITE.id;
                            }
                        } else {
                            let density_ore = noise3d(xyz.y / 10, xyz.x / 10, xyz.z / 10) / 2 + .5;
                            // 0 ... 0.06
                            if(stone_density < 0.06) {
                                stone_block_id = BLOCK$1.DIAMOND_ORE.id;
                            // 0.06 ... 0.1
                            } else if (density_ore < .1) {
                                stone_block_id = BLOCK$1.COAL_ORE.id;
                            // 0.1 ... 0.3
                            } else if (density_ore > .3) {
                                stone_block_id = BLOCK$1.DRIPSTONE_BLOCK.id;
                            // 0.85 ...1
                            } else if (density_ore > .85) {
                                stone_block_id = BLOCK$1.COAL_ORE.id;
                            }
                        }
                    }

                    chunk.setBlockIndirect(x, y, z, stone_block_id);

                    // reset stalactite
                    stalactite_can_start    = stone_block_id == BLOCK$1.DRIPSTONE_BLOCK.id;
                    y_start                 = Infinity;
                    stalactite_height       = 0;

                    fill_count++;

                }
            }
        }

        // Amethyst room
        if(fill_count > CHUNK_SIZE * .7) {
            let chance = aleaRandom.double();
            if(chance < .25) {
                const room_pos = new Vector$1(chunk.size).divScalar(2);
                let temp_vec_amethyst = new Vector$1(0, 0, 0);
                let temp_ar_vec = new Vector$1();
                let rad = chance * 4;
                room_pos.y += Math.round((rad - 0.5) * 10);
                for(let x = 0; x < chunk.size.x; x++) {
                    for(let z = 0; z < chunk.size.z; z++) {
                        for(let y = chunk.size.y - 1; y >= 0; y--) {
                            temp_vec_amethyst.set(x, y, z);
                            let dist = Math.round(room_pos.distance(temp_vec_amethyst));
                            if(dist <= AMETHYST_ROOM_RADIUS) {
                                if(dist > AMETHYST_ROOM_RADIUS - 1.5) {
                                    let b = getBlock(x, y, z);
                                    if(b == 0) {
                                        // air
                                        continue;
                                    } else if (dist >= AMETHYST_ROOM_RADIUS - 1.42) {
                                        chunk.setBlockIndirect(x, y, z, BLOCK$1.AMETHYST.id);
                                    }
                                } else {
                                    chunk.setBlockIndirect(x, y, z, BLOCK$1.AIR.id);
                                }
                            }
                        }
                    }
                }
                // Set amethyst clusters
                let y_start = Math.max(room_pos.y - AMETHYST_ROOM_RADIUS, 1);
                let y_end = Math.min(room_pos.y + AMETHYST_ROOM_RADIUS, chunk.size.y - 2);
                for(let x = 1; x < chunk.size.x - 1; x++) {
                    for(let z = 1; z < chunk.size.z - 1; z++) {
                        for(let y = y_start; y < y_end; y++) {
                            let rnd = aleaRandom.double();
                            if(rnd > AMETHYST_CLUSTER_CHANCE) {
                                continue;
                            }
                            temp_vec_amethyst.set(x, y, z);
                            let dist = Math.round(room_pos.distance(temp_vec_amethyst));
                            if(dist < AMETHYST_ROOM_RADIUS - 1.5) {
                                if(getBlock(x, y, z) == 0) {
                                    let set_vec     = null;
                                    let attempts    = 0;
                                    let rotate      = null;
                                    while(!set_vec && ++attempts < 5) {
                                        let i = Math.round(rnd * 10 * 5 + attempts) % 5;
                                        temp_ar_vec.set(x + sides[i].x, y + sides[i].y, z + sides[i].z);
                                        let b = getBlock(temp_ar_vec.x, temp_ar_vec.y, temp_ar_vec.z);
                                        if(b != 0 && b != BLOCK$1.AMETHYST_CLUSTER.id) {
                                            set_vec = sides[i];
                                            rotate = rotates[i];
                                        }
                                    }
                                    if(set_vec) {
                                        chunk.setBlockIndirect(x, y, z, BLOCK$1.AMETHYST_CLUSTER.id, rotate);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

    }

    //
    intersectChunkWithVoxelBuildings(chunkAABB) {
        const _createBlockAABB_second = this._createBlockAABB_second;
        for (let i = 0; i < this.voxel_buildings.length; i++) {
            const item = this.voxel_buildings[i];
            _createBlockAABB_second.set(
                item.coord.x - item.size.x,
                item.coord.y - item.size.y,
                item.coord.z - item.size.z,
                item.coord.x + item.size.x,
                item.coord.y + item.size.y,
                item.coord.z + item.size.z
            );
            if(chunkAABB.intersect(_createBlockAABB_second)) {
                return true;
            }
        }
        return false;
    }

    //
    intersectChunkWithIslands(chunkAABB) {
        const _createBlockAABB_second = this._createBlockAABB_second;
        for (let i = 0; i < this.islands.length; i++) {
            const item = this.islands[i];
            const rad = item.rad;
            _createBlockAABB_second.set(
                item.pos.x - rad,
                item.pos.y - rad,
                item.pos.z - rad,
                item.pos.x + rad,
                item.pos.y + rad,
                item.pos.z + rad
            );
            if(chunkAABB.intersect(_createBlockAABB_second)) {
                return true;
            }
        }
        return false;
    }

    // extruders
    intersectChunkWithExtruders(chunkAABB) {
        const _createBlockAABB_second = this._createBlockAABB_second;
        for (let i = 0; i < this.extruders.length; i++) {
            const item = this.extruders[i];
            const rad = item.rad;
            _createBlockAABB_second.set(
                item.pos.x - rad,
                item.pos.y - rad,
                item.pos.z - rad,
                item.pos.x + rad,
                item.pos.y + rad,
                item.pos.z + rad
            );
            if(chunkAABB.intersect(_createBlockAABB_second)) {
                return true;
            }
        }
        return false;
    }

    // Endless spiral staircase
    drawSpiralStaircases(chunk) {
        for(let y = 0; y < chunk.size.y; y += .25) {
            let y_abs = y + chunk.coord.y;
            let y_int = parseInt(y);
            let x = 8 + parseInt(Math.sin(y_abs / Math.PI) * 6);
            let z = 8 + parseInt(Math.cos(y_abs / Math.PI) * 6);
            let block = BLOCK$1.BEDROCK;
            if(y >= 1) {
                chunk.setBlockIndirect(x, y_int - 1, z, block.id);
            }
            if(y_abs % 16 == 1) {
                block = BLOCK$1.GOLD;
            }
            if(y_abs % 32 == 1) {
                block = BLOCK$1.DIAMOND_ORE;
            }
            chunk.setBlockIndirect(x, y_int, z, block.id);
        }
    }

    // Проверка не является ли этот блок пещерой
    checkIsCaveBlock(xyz, neighbour_lines, value) {
        for(let k = neighbour_lines.list.length - 1; k >= 0; k--) {
            const line = neighbour_lines.list[k];
            if(line.is_treasure) {
                if(line.aabb.contains(xyz.x, xyz.y, xyz.z)) {
                    return line;
                }
            } else {
                let dist = xyz.distanceToLine(line.p_start, line.p_end, _intersection);
                if(dist < line.rad * 1) {
                    return line;
                }
                //
                if(xyz.y < value - 1 || xyz.y > value) {
                    let r = randoms[Math.abs(xyz.x + xyz.y + xyz.z) % randoms.length];
                    if(dist < line.rad + r * 1) {
                        return line;
                    }
                }
            }
        }
        return false;
    }

    // Проверка того, чтобы под деревьями не удалялась земля (в радиусе 5 блоков)
    nearTree(chunk, xyz, value2, cluster, maps) {
        const _createBlockAABB = this._createBlockAABB;
        const _createBlockAABB_second = this._createBlockAABB_second;
        if(!cluster.is_empty) {
            if(xyz.y > value2 - 3 && xyz.y < value2 + 1) {
                if(cluster.cellIsOccupied(xyz.x, xyz.y, xyz.z, 2)) {
                    return true;
                }
            }
        }
        const near_rad = 5;
        // const check_only_current_map = (x >= near_rad && y >= near_rad && z >= near_rad && x < CHUNK_SIZE_X - near_rad &&  y < CHUNK_SIZE_Y - near_rad && z < CHUNK_SIZE_Z - near_rad);
        _createBlockAABB_second.set(
            xyz.x - near_rad,
            xyz.y - near_rad - chunk.coord.y,
            xyz.z - near_rad,
            xyz.x + near_rad,
            xyz.y + near_rad - chunk.coord.y,
            xyz.z + near_rad
        );
        for(let m of maps) {
            if(m.trees.length == 0) {
                continue;
            }
            //
            _createBlockAABB.set(
                m.chunk.coord.x,
                m.chunk.coord.y,
                m.chunk.coord.z,
                m.chunk.coord.x + CHUNK_SIZE_X,
                m.chunk.coord.y + CHUNK_SIZE_Y,
                m.chunk.coord.z + CHUNK_SIZE_Z
            );
            if(!_createBlockAABB.intersect(_createBlockAABB_second)) {
                continue;
            }
            ppos.set(xyz.x - m.chunk.coord.x, xyz.y - m.chunk.coord.y, xyz.z - m.chunk.coord.z);
            for (let i = 0; i < m.trees.length; i++) {
                const tree = m.trees[i];
                if(tree.pos.distance(ppos) < near_rad) {
                    return true;
                }
            }
        }
        return false;
    }

    // drawBuilding...
    drawBuilding(xyz, x, y, z, chunk) {
        let vb = this.getVoxelBuilding(xyz);
        if(vb) {
            let block = vb.getBlock(xyz);
            if(block) {
                chunk.setBlockIndirect(x, y, z, block.id);
            }
            return true;
        }
        return false;
    }

    // drawIsland
    drawIsland(xyz, x, y, z, chunk) {
        for (let i = 0; i < this.islands.length; i++) {
            const island = this.islands[i];
            let dist = xyz.distance(island.pos);
            if(dist < island.rad) {
                if(xyz.y < island.pos.y) {
                    if(xyz.y < island.pos.y - 3) {
                        chunk.setBlockIndirect(x, y, z, BLOCK$1.CONCRETE.id);
                        return true;
                    } else {
                        if(dist < island.rad * 0.9) {
                            chunk.setBlockIndirect(x, y, z, BLOCK$1.CONCRETE.id);
                            return true;
                        } else {
                            chunk.setBlockIndirect(x, y, z, BLOCK$1.GRASS_DIRT.id);
                            return true;
                        }
                    }
                }
                break;
            }
        }
        return false;
    }

    // extrude
    extrude(xyz) {
        for (let i = 0; i < this.extruders.length; i++) {
            const extruder = this.extruders[i];
            if(xyz.distance(extruder.pos) < extruder.rad) {
                return true;
            }
        }
        return false;
    }

    // getTreasureRoomMat
    getTreasureRoomMat(xyz, is_floor, level) {
        if(!is_floor && level == 0) {
            return BLOCK$1.LODESTONE.id;
        }
        let rb = randoms[Math.abs(xyz.x + xyz.y + xyz.z) % randoms.length];
        if(rb < .2) {
            return BLOCK$1.MOSS_BLOCK.id;
        } else if (rb < .8) {
            return BLOCK$1.STONE_BRICK.id;
        } else {
            return BLOCK$1.MOSSY_STONE_BRICKS.id;
        }
    }

    // drawTreasureRoom...
    drawTreasureRoom(chunk, line, xyz, x, y, z) {
        if(xyz.y < line.p_start.y || xyz.y == line.p_start.y + Math.round(line.rad) - 1) {
            chunk.setBlockIndirect(x, y, z, this.getTreasureRoomMat(xyz, true));
        } else {
            if(
                // long walls
                (xyz.z == line.p_start.z + Math.floor(line.rad)) ||
                (xyz.z == line.p_end.z - Math.floor(line.rad)) ||
                // short walls
                (xyz.x == line.p_end.x + Math.floor(line.rad)) ||
                (xyz.x == line.p_start.x - Math.floor(line.rad))
            ) {
                chunk.setBlockIndirect(x, y, z, this.getTreasureRoomMat(xyz, false, xyz.y - line.p_start.y));
            } else if (xyz.x == line.p_start.x - Math.floor(line.rad) + 7) {
                // 3-th short wall with door
                if(xyz.z != line.p_start.z || (xyz.z == line.p_start.z && xyz.y > line.p_start.y + 2)) {
                    chunk.setBlockIndirect(x, y, z, this.getTreasureRoomMat(xyz, false, xyz.y - line.p_start.y));
                } else {
                    // iron bars over door
                    if(xyz.y == line.p_start.y + 2) {
                        chunk.setBlockIndirect(x, y, z, BLOCK$1.IRON_BARS.id);
                    }
                }
            }
            if(xyz.y == line.p_start.y) {
                // chest
                if(xyz.z == line.p_start.z) {
                    let cx = Math.round((line.p_start.x + line.p_end.x) / 2) - 6;
                    if(xyz.x == cx) {
                        chunk.setBlockIndirect(x, y, z, BLOCK$1.CHEST.id, DEFAULT_CHEST_ROTATE, {generate: true, params: {source: 'treasure_room'}});
                    }
                    if(xyz.x == cx + 3) {
                        chunk.setBlockIndirect(x, y, z, BLOCK$1.MOB_SPAWN.id, DEFAULT_CHEST_ROTATE);
                    }
                }
            }
        }
    }

}

var index$5 = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': Terrain_Generator$4
});

class Terrain_Generator$3 extends Default_Terrain_Generator {

    constructor(seed, world_id) {
        super(seed, world_id, options);
        this.setSeed(0);
        // Init palette blocks
        this.blocks1 = [];
        for(let b of BLOCK$1.getAll()) {
            if (b.name.substring(0, 4) === 'TERR' || b.name.substring(0, 4) === 'WOOL') {
                this.blocks1.push(b);
            }
        }
    }

    async init() {}

    /**
     * setSeed
     * @param { string } seed 
     */
    setSeed(seed) {
    }

    /**
     * 
     * @param { Chunk } chunk 
     * @returns 
     */
    generate(chunk) {

        if(chunk.addr.y < 10000) {

            const seed                  = chunk.addr.sub(new Vector$1(0, chunk.addr.y, 0)).toString();
            let aleaRandom              = new impl(seed);

            let BRICK   = BLOCK$1.BRICKS;
            let GLASS   = BLOCK$1.GLASS;
            let LIGHT   = BLOCK$1.GLOWSTONE;
            const wnd   = [0, 0, 0, 0, 0, 0, 0, 0, 0];

            let r = aleaRandom.double();
            if(r < .2) {
                BRICK = BLOCK$1.CONCRETE;
            } else if (r < .4) {
                BRICK = BLOCK$1.STONE_BRICK;
            }

            // ЖД через каждые 9 кварталов
            if(chunk.addr.x % 10 == 0) {

                // только на первом уровне
                if(chunk.addr.y == 0) {

                    for(let x = 0; x < chunk.size.x; x++) {
                        for (let z = 0; z < chunk.size.z; z++) {
                            if(x == 0 || x >= 14) {
                                this.setBlock(chunk, x, 0, z, BLOCK$1.BEDROCK, false);
                            } else if (x == 1 || x == 13) {
                                this.setBlock(chunk, x, 0, z, BLOCK$1.CONCRETE, false);
                            } else if(x) {
                                this.setBlock(chunk, x, 0, z, BLOCK$1.GRASS_DIRT, false);
                            }
                        }
                    }

                    // ЖД
                    for(let z = 0; z < chunk.size.z; z++) {
                        // рельсы
                        this.setBlock(chunk, 7, 12, z, BLOCK$1.OAK_PLANK, false);
                        // по краям рельс
                        this.setBlock(chunk, 6, 12, z, BLOCK$1.STONE_BRICK, false);
                        this.setBlock(chunk, 7, 12, z, BLOCK$1.STONE_BRICK, false);
                        // шпалы
                        if(z % 2 == 0) {
                            for(let a of [4, 5, 6, 7, 8, 9]) {
                                this.setBlock(chunk, a, 12 + 1, z, BLOCK$1.CONCRETE, false);
                            }
                        }
                        // рельсы
                        for(let y = 14; y < 15; y++) {
                            this.setBlock(chunk, 5, y, z, BLOCK$1.BLACK_WOOL, false);
                            this.setBlock(chunk, 8, y, z, BLOCK$1.BLACK_WOOL, false);
                        }
                        // столбы
                        if(z == 4) {
                            for(let y = 0; y < 12; y++) {
                                this.setBlock(chunk, 5, y, z, BLOCK$1.STONE_BRICK, false);
                                this.setBlock(chunk, 8, y, z, BLOCK$1.STONE_BRICK, false);
                            }
                        }
                    }

                    // разметка
                    for(let x = 1; x < chunk.size.z-2; x += 2) {
                        this.setBlock(chunk, 15, 0, x + 1, BLOCK$1.POWDER_SNOW, false);
                    }

                }

            } else {

                // Этажи
                let levels = aleaRandom.double() * 10 + 4;
                if(levels > 8) {
                    levels = aleaRandom.double() * 10 + 4;
                }
                levels |= 0;
                if(aleaRandom.double() < .1) {
                    levels = -1;
                }
                let H = 1;

                if(chunk.addr.y == 0) {

                    for(let x = 0; x < chunk.size.x; x++) {
                        for (let z = 0; z < chunk.size.z; z++) {
                            for (let y = 0; y < 1; y++) {
                                if (x > 0 && x < 14 && z > 1 && z < 15) {
                                    // территория строений
                                    // трава
                                    if (x >= 2 && x <= 12 && z >= 3 && z <= 13) {
                                        this.setBlock(chunk, x, y, z, BLOCK$1.GRASS_DIRT, false);
                                    } else {
                                        this.setBlock(chunk, x, y, z, BLOCK$1.CONCRETE, false);
                                    }
                                } else {
                                    // дороги вокруг дома
                                    this.setBlock(chunk, x, y, z, BLOCK$1.BEDROCK, false);
                                }
                            }
                        }
                    }

                    // Разметка
                    for(let v = 1; v < chunk.size.z - 2; v += 2) {
                        this.setBlock(chunk, v, 0, 0, BLOCK$1.POWDER_SNOW, false);
                        this.setBlock(chunk, 15, 0, v + 1, BLOCK$1.POWDER_SNOW, false);
                        // Тачка
                        let carColor = this.blocks1[(aleaRandom.double() * this.blocks1.length | 0)];
                        if(aleaRandom.double() < .1) {
                            this.setBlock(chunk, 6, 1, 0, BLOCK$1.CONCRETE, false);
                            this.setBlock(chunk, 8, 1, 0, BLOCK$1.CONCRETE, false);
                            for(let cv = 5; cv < 10; cv++) {
                                this.setBlock(chunk, cv, 2, 0, carColor, false);
                            }
                            this.setBlock(chunk, 6, 3, 0, BLOCK$1.GLASS, false);
                            this.setBlock(chunk, 7, 3, 0, BLOCK$1.GLASS, false);
                            this.setBlock(chunk, 8, 3, 0, BLOCK$1.GLASS, false);
                        }
                        // Тачка 2
                        carColor = this.blocks1[(aleaRandom.double() * this.blocks1.length | 0)];
                        if(aleaRandom.double() < .1) {
                            this.setBlock(chunk, 15, 1, 6, BLOCK$1.CONCRETE, false);
                            this.setBlock(chunk, 15, 1, 8, BLOCK$1.CONCRETE, false);
                            for(let cv = 5; cv < 10; cv++) {
                                this.setBlock(chunk, 15, 2, cv, carColor, false);
                            }
                            this.setBlock(chunk, 15, 3, 6, BLOCK$1.GLASS, false);
                            this.setBlock(chunk, 15, 3, 7, BLOCK$1.GLASS, false);
                            this.setBlock(chunk, 15, 3, 8, BLOCK$1.GLASS, false);
                        }
                    }

                    // Парк (дерево)
                    if (levels < 0 || aleaRandom.double() < .05) {
                        let y = 1;
                        for(let x = 3; x <= 11; x++) {
                            for(let z = 4; z <= 12; z++) {
                                this.setBlock(chunk, x, y, z, BLOCK$1.GRASS_DIRT, false);
                            }
                        }
                        this.plantTree({
                                height: (aleaRandom.double() * 4 | 0) + 5,
                                type: {
                                    style: 'wood',
                                    trunk: BLOCK$1.SPRUCE_TRUNK.id,
                                    leaves: BLOCK$1.SPRUCE_LEAVES.id,
                                    height: 7
                                }
                            },
                            chunk,
                            5 + (aleaRandom.double() * 4 | 0), H + 1, 5 + (aleaRandom.double() * 4 | 0)
                        );
                    }

                }

                // Здание
                if(levels > 0) {
                    aleaRandom = new impl(seed);
                    let mainColor = this.blocks1[(aleaRandom.double() * this.blocks1.length | 0)];
                    let y = 1;
                    for(let level = 1; level <= levels; level++) {
                        let h = (aleaRandom.double() * 2 | 0) + 3; // высота комнаты
                        if(level == levels) {
                            h = 0;
                        }
                        // Межэтажные перекрытия
                        if(y - chunk.coord.y >= 0 && y - chunk.coord.y < chunk.size.y) {
                            for(let x = 2; x <= 12; x++) {
                                for (let z = 3; z <= 13; z++) {
                                    this.setBlock(chunk, x, y - chunk.coord.y, z, mainColor, false);
                                }
                            }
                        }
                        // Остекление и стены
                        if(level < levels) {
                            // если это потолок последнего этажа, то стены не нужны
                            for(let i = 0; i < 12; i++) {
                                wnd[i] = aleaRandom.double() * 12 < 1.0 ? LIGHT : null;
                            }
                            if (aleaRandom.double() < .1) {
                                mainColor = this.blocks1[(aleaRandom.double() * this.blocks1.length | 0)];
                            }
                            for(let y_abs = y + 1; y_abs <= y + h; y_abs++) {
                                if(y_abs < chunk.coord.y || y_abs >= chunk.coord.y + chunk.size.y) {
                                    continue;
                                }
                                let y = y_abs - chunk.coord.y;
                                for(let x = 0; x <= 10; x++) {
                                    let b = -1;
                                    if (x > 0 && x < 3) b = 0;
                                    if (x > 3 && x < 7) b = 1;
                                    if (x > 7 && x < 10) b = 2;
                                    this.setBlock(chunk, x + 2, y, 3, b >= 0 ? GLASS : BRICK, false);
                                    this.setBlock(chunk, x + 2, y, 3, b >= 0 ? GLASS : BRICK, false);
                                    this.setBlock(chunk, x + 2, y, 13, b >= 0 ? GLASS : BRICK, false);
                                    this.setBlock(chunk, 2, y, x + 3, b >= 0 ? GLASS : BRICK, false);
                                    this.setBlock(chunk, 12, y, x + 3, b >= 0 ? GLASS : BRICK, false);
                                    if (b > 0 && x > 0 && x < 10) {
                                        // chunk.blocks[x + 2][4][y] ||= wnd[b * 4 + 0];
                                        // chunk.blocks[x + 2][12][y] ||= wnd[b * 4 + 1];
                                        // chunk.blocks[3][x + 3][y] ||= wnd[b * 4 + 2];
                                        // chunk.blocks[11][x + 3][y] ||= wnd[b * 4 + 3];
                                        // this.setBlock(chunk, x + 2, y, 4, wnd[b * 4 + 0], false);
                                        // this.setBlock(chunk, x + 2, y, 12, wnd[b * 4 + 1], false);
                                        // this.setBlock(chunk, 3,     y, x + 3, wnd[b * 4 + 2], false);
                                        // this.setBlock(chunk, 11,    y, x + 3, wnd[b * 4 + 3], false);
                                    }
                                }
                            }
                        }
                        y += h + 1;
                    }
                    // Строения на крыше
                    if(y - chunk.coord.y >= 0 && y - chunk.coord.y < chunk.size.y) {
                        for(let sz of [1, 2, 2]) {
                            let ceil_x = 3 + parseInt(aleaRandom.double() * 8);
                            let ceil_z = 4 + parseInt(aleaRandom.double() * 8);
                            for(let i = 0; i < sz; i++) {
                                for(let j = 0; j < sz; j++) {
                                    this.setBlock(chunk, ceil_x + i, y - chunk.coord.y, ceil_z + j, mainColor, false);
                                }
                            }
                        }
                    }
                }

            }
        }

        const cell = {dirt_color: new Color(850 / 1024, 930 / 1024, 0, 0), biome: {
            code: 'City'
        }};

        const addr = chunk.addr;
        const size = chunk.size;

        return {
            id:     [addr.x, addr.y, addr.z, size.x, size.y, size.z].join('_'),
            blocks: {},
            seed:   chunk.seed,
            addr:   addr,
            size:   size,
            coord:  addr.mul(size),
            cells:  Array(chunk.size.x * chunk.size.z).fill(cell),
            options: {
                WATER_LINE: 63, // Ватер-линия
            }
        };

    }

}

var index$4 = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': Terrain_Generator$3
});

//
let palette = {
    150: BLOCK$1.OAK_LEAVES,
    80: BLOCK$1.OAK_TRUNK,
    112: BLOCK$1.SAND,
    252: BLOCK$1.CONCRETE,
    192: BLOCK$1.ICE,
    235: BLOCK$1.IRON,
    248: BLOCK$1.SMOOTH_STONE,
    106: BLOCK$1.BIRCH_PLANK,
    38: BLOCK$1.TERRACOTTA_RED,
    246: BLOCK$1.IRON,
    254: BLOCK$1.BLACK_WOOL,
    236: BLOCK$1.TERRACOTTA_CYAN,
    103: BLOCK$1.GOLD,
    253: BLOCK$1.GRAY_WOOL,
    143: BLOCK$1.GRASS_DIRT,
    139: BLOCK$1.GREEN_WOOL,
    29: BLOCK$1.TERRACOTTA_GRAY,
    111: BLOCK$1.CONCRETE_YELLOW,
    198: BLOCK$1.BLUE_WOOL,
    30: BLOCK$1.TERRACOTTA_RED, // BRICK
    252: BLOCK$1.GRAY_WOOL,
    90: BLOCK$1.CLAY,
    237: BLOCK$1.GRAY_WOOL,
    165: BLOCK$1.CONCRETE_CYAN,
    166: BLOCK$1.CYAN_WOOL,
    174: BLOCK$1.BLUE_WOOL,
    234: BLOCK$1.POWDER_SNOW,

    238: BLOCK$1.TEST,

    // 97: BLOCK.OAK_PLANK,
    // 121: BLOCK.STONE_BRICK,
    // 122: BLOCK.SMOOTH_STONE,
    // 123: BLOCK.GRAVEL,
};

let vox_templates = {};

class Terrain_Generator$2 extends Default_Terrain_Generator {

    constructor(seed, world_id, options) {
        super(seed, world_id, options);
        this.setSeed(0);
    }

    async init() {
        // Костыль для NodeJS
        let root_dir = '../www';
        if(typeof process === 'undefined') {
            root_dir = '';
        }
        await Vox_Loader.load(root_dir + '/data/vox/city/City_1.vox', (chunks) => {
            vox_templates.city1 = {chunk: chunks[0], palette: palette};
        });
        await Vox_Loader.load(root_dir + '/data/vox/city/City_2.vox', (chunks) => {
            vox_templates.city2 = {chunk: chunks[0], palette: palette};
        });
        // Voxel buildings
        this.voxel_buildings = [
            new Vox_Mesh(vox_templates.city1, new Vector$1(0, 0, 0), new Vector$1(0, 0, 0), null, null),
            new Vox_Mesh(vox_templates.city2, new Vector$1(0, 0, 0), new Vector$1(0, 0, 0), null, null)
        ];
    }

    /**
     * setSeed
     * @param { string } seed
     */
    setSeed(seed) {
    }

    /**
     *
     * @param { Chunk } chunk
     * @returns
     */
    generate(chunk) {
        const { cx, cy, cz, cw } = chunk.dataChunk;
        // setBlock
        const setBlock = (x, y, z, block_id) => {
            const index = cx * x + cy * y + cz * z + cw;
            chunk.tblocks.id[index] = block_id;
        };

        if(chunk.addr.y < 5) {

            // только на первом уровне
            if(chunk.addr.y == 0) {
                for(let x = 0; x < chunk.size.x; x++) {
                    for (let z = 0; z < chunk.size.z; z++) {
                        // this.setBlock(chunk, x, 0, z, BLOCK.BEDROCK, false);
                        setBlock(x, 0, z, BLOCK$1.BEDROCK.id);
                    }
                }
            }

            if(chunk.addr.x < 0 || chunk.addr.z < 0 || chunk.coord.y > 100) {
                // do nothing
            } else {

                for(let x = 0; x < chunk.size.x; x++) {
                    for (let z = 0; z < chunk.size.z; z++) {
                        for (let y = 0; y < chunk.size.y; y++) {
                            let xyz     = new Vector$1(x, y, z).add(chunk.coord);
                            let index   = (xyz.x / 126 | 0 + xyz.z / 126 | 0) % 2;
                            let vb      = this.voxel_buildings[index];
                            xyz.x = xyz.x % 126;
                            xyz.z = xyz.z % 126;
                            let block   = vb.getBlock(xyz);
                            if(block) {
                                // this.setBlock(chunk, x, y, z, block, false);
                                setBlock(x, y, z, block.id);
                            }
                        }
                    }
                }
            }

        }

        const cell = {dirt_color: new Color(850 / 1024, 930 / 1024, 0, 0), biome: {
            code: 'City2'
        }};

        const addr = chunk.addr;
        const size = chunk.size;

        return {
            id:     [addr.x, addr.y, addr.z, size.x, size.y, size.z].join('_'),
            blocks: {},
            seed:   chunk.seed,
            addr:   addr,
            size:   size,
            coord:  addr.mul(size),
            cells:  Array(chunk.size.x * chunk.size.z).fill(cell),
            options: {
                WATER_LINE: 63, // Ватер-линия
            }
        };

    }

}

var index$3 = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': Terrain_Generator$2
});

class Terrain_Generator$1 extends Default_Terrain_Generator {

    constructor(seed, world_id, options) {
        super(seed, world_id, options);
        this.setSeed(0);
    }

    async init() {}

    generate(chunk) {

        // let block_id = (chunk.addr.x + chunk.addr.z) % 2 == 0 ? BLOCK.DARK_OAK_PLANK.id : BLOCK.BIRCH_PLANK.id;
        let block_id = BLOCK$1.GRASS_DIRT.id;

        const { cx, cy, cz, cw } = chunk.dataChunk;

        // setBlock
        const setBlock = (x, y, z, block_id) => {
            const index = cx * x + cy * y + cz * z + cw;
            chunk.tblocks.id[index] = block_id;
        };

        if(chunk.addr.y == 0) {
            for(let x = 0; x < chunk.size.x; x++) {
                for(let z = 0; z < chunk.size.z; z++) {
                    for(let y = 0; y < 1; y++) {
                        setBlock(x, y, z, block_id);
                    }
                }
            }
        }

        const cell = {dirt_color: new Color(850 / 1024, 930 / 1024, 0, 0), biome: {
            code: 'Flat'
        }};

        const addr = chunk.addr;
        const size = chunk.size;

        return {
            id:     [addr.x, addr.y, addr.z, size.x, size.y, size.z].join('_'),
            blocks: {},
            seed:   chunk.seed,
            addr:   addr,
            size:   size,
            coord:  addr.mul(size),
            cells:  Array(chunk.size.x * chunk.size.z).fill(cell),
            options: {
                WATER_LINE: 63, // Ватер-линия
            }
        };

    }

}

var index$2 = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': Terrain_Generator$1
});

class MineGenerator2 extends Default_Terrain_Generator {

    constructor(seed, world_id, options) {
        super(seed, world_id, options);
        this.setSeed(0);
        this.mine = new MineGenerator(this, new Vector$1(22, 0, 22), {chance_hal: 0.2});
    }

    async init() {}
    
    generate(chunk) {
        if(chunk.addr.y == 0) {
            for(let x = 0; x < chunk.size.x; x++) {
                for(let z = 0; z < chunk.size.z; z++) {
                    for(let y = 0; y <= 6; y++) {
                        this.setBlock(chunk, x, y, z, BLOCK$1.GRASS_DIRT);
                    }
                }
            }
        }
        
        this.mine.fillBlocks(chunk);

        const cell = {dirt_color: new Color(850 / 1024, 930 / 1024, 0, 0), biome: {
            code: 'Flat'
        }};

        let addr = chunk.addr;
        let size = chunk.size;

        return {
            id:     [addr.x, addr.y, addr.z, size.x, size.y, size.z].join('_'),
            blocks: {},
            seed:   chunk.seed,
            addr:   addr,
            size:   size,
            coord:  addr.mul(size),
            cells:  Array(chunk.size.x * chunk.size.z).fill(cell),
            options: {
                WATER_LINE: 63, // Ватер-линия
            }
        };

    }
}

var index$1 = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': MineGenerator2
});

class Terrain_Generator extends Default_Terrain_Generator {

    constructor(seed, world_id, options) {
        super(seed, world_id, options);
        this.setSeed(0);
    }

    async init() {}

    generate(chunk) {

        let block_id = Math.abs(chunk.addr.x + chunk.addr.z) % 2 == 1 ? BLOCK$1.GRASS_DIRT.id : BLOCK$1.DIRT.id;
        const aleaRandom = new impl(chunk.id);

        // setBlock
        const { cx, cy, cz, cw } = chunk.dataChunk;
        // setBlock
        const setBlock = (x, y, z, block_id) => {
            const index = cx * x + cy * y + cz * z + cw;
            chunk.tblocks.id[index] = block_id;
        };

        //
        const tree_height = {min: 5, max: 8};
        const tree_types = Object.keys(TREES);
        const tree_type_index = Math.floor(aleaRandom.double() * tree_types.length);
        const tree_type_key = tree_types[tree_type_index];
        const tree_type = TREES[tree_type_key];

        if(chunk.addr.y == 0) {
            for(let x = 0; x < chunk.size.x; x++) {
                for(let z = 0; z < chunk.size.z; z++) {
                    for(let y = 0; y < 1; y++) {
                        setBlock(x, y, z, block_id);
                    }
                }
            }
            // Посадка дерева
            this.plantTree(
                {
                    // рандомная высота дерева
                    height: Math.round(aleaRandom.double() * (tree_type.height.max - tree_type.height.min) + tree_type.height.min),
                    type: tree_type
                },
                chunk,
                // XYZ позиция в чанке
                7, 1, 7
            );
        }

        const cell = {dirt_color: new Color(850 / 1024, 930 / 1024, 0, 0), biome: {
            code: 'Flat'
        }};

        let addr = chunk.addr;
        let size = chunk.size;

        return {
            id:     [addr.x, addr.y, addr.z, size.x, size.y, size.z].join('_'),
            blocks: {},
            seed:   chunk.seed,
            addr:   addr,
            size:   size,
            coord:  addr.mul(size),
            cells:  Array(chunk.size.x * chunk.size.z).fill(cell),
            options: {
                WATER_LINE: 63, // Ватер-линия
            }
        };

    }

}

var index = /*#__PURE__*/Object.freeze({
	__proto__: null,
	'default': Terrain_Generator
});

module.exports = chunk_worker;
