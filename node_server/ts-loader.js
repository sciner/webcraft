import { resolve as resolveTs } from 'ts-node/esm'
import * as tsConfigPaths from 'tsconfig-paths'
import { pathToFileURL } from 'url'

const { absoluteBaseUrl, paths } = tsConfigPaths.loadConfig()
const matchPath = tsConfigPaths.createMatchPath(absoluteBaseUrl, paths)

export function resolve (specifier, ctx, defaultResolve) {
    // if you want to see full resolve log
    // console.log(`specifier! ${specifier}`);
    const lastIndexOfIndex = specifier.lastIndexOf('/index.js')
    if (lastIndexOfIndex !== -1) {
        // Handle index.js
        const trimmed = specifier.substring(0, lastIndexOfIndex)
        const match = matchPath(trimmed)
        if (match) return resolveTs(pathToFileURL(`${match}/index.js`).href, ctx, defaultResolve)
    } else if (specifier.endsWith('.js')) {
        // Handle *.js
        const trimmed = specifier.substring(0, specifier.length - 3)
        const match = matchPath(trimmed)
        if (match) return resolveTs(pathToFileURL(`${match}.js`).href, ctx, defaultResolve)
    } else if (specifier.endsWith('.json')) {
        // Handle *.json
        const trimmed = specifier.substring(0, specifier.length - 5)
        const match = matchPath(trimmed)
        if (match) return defaultResolve(pathToFileURL(`${match}.json`).href)
    }
    return resolveTs(specifier, ctx, defaultResolve)
}

export { load, transformSource } from 'ts-node/esm'
