import path from 'path';
import fs from 'fs';
import { getOptions } from 'loader-utils';
import validateOptions from 'schema-utils';
import debug from './debug';

const NS = '__moduleOverrides__';

const schema = {
    type: 'object',
    properties: {
        overrides: {
            type: 'array',
            minItems: 1
        },
        pattern: {
            type: 'string'
        }
    },
    required: ['overrides', 'pattern']
};

const REGEXP_NAME = /\[name\]/gi;
const REGEXP_EXT = /\[ext\]/gi;
const REGEXP_OVERRIDE = /\[override\]/gi;
const getReplacer = (value, allowEmpty) => {
    const fn = (match, ...args) => {
        // last argument in replacer is the entire input string
        const input = args[args.length - 1];
        if (value === null || value === undefined) {
            if (!allowEmpty)
                throw new Error(
                    `Path variable ${match} not implemented in this context: ${input}`
                );
            return "";
        } else {
            return `${value}`;
        }
    };
    return fn;
};

function getOverrideName({ name, ext, override, pattern }) {
    let overrideName = pattern.replace(REGEXP_NAME, getReplacer(name));
    overrideName = overrideName.replace(REGEXP_EXT, getReplacer(ext));
    overrideName = overrideName.replace(REGEXP_OVERRIDE, getReplacer(override));

    return overrideName;
}

export default function(content, map) {
    const options = getOptions(this);
    validateOptions(schema, options, 'module-override-loader');

    this.cacheable && this.cacheable(false);

    const callback = this.async();

    if(!this._compilation[NS]) {
        this._compilation[NS] = {};
    }

    if(this._compilation[NS].loadedOverrides && this._compilation[NS].loadedOverrides.indexOf(this.resourcePath) > -1) {
        callback(null, content, map);
        return;
    }

    const dir = path.dirname(this.resourcePath);
    const filename = path.basename(this.resourcePath);
    let ext = path.extname(filename);
    const name = path.basename(filename, ext);

    if(ext && ext[0] === '.') {
        ext = ext.substring(1);
    }

    debug('Searching for overrides for module', filename);
    debug('Enabled overrides: [', options.overrides.join(', '), ']');

    const promises = [];
    for(let i = 0, length = options.overrides.length; i < length; i += 1) {
        const override = options.overrides[i];
        const overrideFileName = getOverrideName({ name, ext, override, pattern: options.pattern });
        const overridePath = path.join(dir, overrideFileName);

        const promise = new Promise((resolve, reject) => {
            fs.stat(overridePath, (error) => {
                if (error) {
                    if (error.code === "ENOENT") {
                        debug(`Override for ${filename} [${override}] not found`);
                        return resolve();
                    }

                    return reject(error);
                }

                debug(`Override for ${filename} [${override}] found: ${overrideFileName}`);

                // Store module paths loaded by this loader to prevent endless loop
                if(!this._compilation[NS].loadedOverrides) {
                    this._compilation[NS].loadedOverrides = [];
                }
                this._compilation[NS].loadedOverrides.push(overridePath);

                this.loadModule(overridePath, (error, result) => {
                    if(error) {
                        return reject(error);
                    }

                    if(!this._compilation[NS].overridesMap) {
                        this._compilation[NS].overridesMap = {};
                    }
                    if(!this._compilation[NS].overridesMap[this.resourcePath]) {
                        this._compilation[NS].overridesMap[this.resourcePath] = {};
                    }

                    this._compilation[NS].overridesMap[this.resourcePath][override] = overridePath;

                    return resolve();
                });
            });
        });

        promises.push(promise);
    }

    Promise.all(promises)
        .then(() => callback(null, content, map))
        .catch(callback);

    return;
};