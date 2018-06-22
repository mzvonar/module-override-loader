import path from 'path';
import fs from 'fs';
import { getOptions } from 'loader-utils';
import validateOptions from 'schema-utils';

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
    const ext = path.extname(filename);
    const name = path.basename(filename, ext);

    const promises = [];
    for(let i = 0, length = options.overrides.length; i < length; i += 1) {
        const override = options.overrides[i];

        const overridePath = [dir, path.sep, name, '.', override, ext].join('');

        const promise = new Promise((resolve, reject) => {
            fs.stat(overridePath, (error) => {
                if (error) {
                    if (error.code === "ENOENT") {
                        return resolve();
                    }

                    return reject(error);
                }

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