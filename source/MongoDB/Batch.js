import MongoDB from './index'
import DataLoader from 'dataloader'

let loaders = {}

const getLoader = async (key, collection, database = 'default') => {
    if(!loaders[key])
        loaders[key] = {}

    if(!loaders[key][database])
        loaders[key][database] = {}

    if(!loaders[key][database][collection])
        switch(key) {

            case 'load':
                loaders[key][database][collection] = new DataLoader(
                    async keys => {
                        let result = {}
                        await MongoDB.getDatabase(database).collection(collection).find({
                            _id: {
                                $in: keys.map(
                                    key =>
                                        MongoDB.IDRegex.test(key) ? MongoDB.ObjectID(key) : key
                                )
                            }
                        }).toArray().then(
                            documents => {
                                documents.forEach(
                                    (document, i) =>
                                        result[`${document._id}`] = document
                                )
                            }
                        )
                        return keys.map(
                            (key, i) =>
                                result[key] || null
                        )
                    }
                )
                break

            case 'loadAll':
                loaders[key][database][collection] = new DataLoader(
                    keys => {
                        return Promise.all(
                            keys.map(
                                async key => {
                                    let {
                                            query = {},
                                            page = 1,
                                            limit = 20
                                        } = key,
                                        cursor = MongoDB.getDatabase(database).collection(collection).find(query)

                                    return {
                                        list: await cursor.limit(limit).skip(limit * (page - 1)).toArray(),
                                        total: await cursor.count(),
                                        page,
                                        limit
                                    }
                                }
                            )
                        )
                    },
                    {
                        cache: false
                    }
                )
                break

            case 'count':
                loaders[key][database][collection] = new DataLoader(
                    keys => {
                        return Promise.all(
                            keys.map(
                                async query =>
                                    MongoDB.getDatabase(database).collection(collection).count(query)
                            )
                        )
                    },
                    {
                        cache: false
                    }
                )
                break

                case 'insert':

                    loaders[key][database][collection] = new DataLoader(
                        async keys => {
                            let bulk = MongoDB.getDatabase(database).collection(collection).initializeUnorderedBulkOp()
                            keys.forEach(
                                object =>
                                    bulk.insert(object)
                            )
                            return (await bulk.execute()).getInsertedIds().map(id => id._id)
                        },
                        {
                            cache: false
                        }
                    )

                    break

                case 'update':

                    loaders[key][database][collection] = new DataLoader(
                        async keys => {
                            let bulk = MongoDB.getDatabase(database).collection(collection).initializeUnorderedBulkOp()
                            keys.forEach(
                                ([id, payload]) => {

                                    if(!Array.isArray(payload))
                                        payload = [payload]

                                    payload.filter(
                                        payload =>
                                            Object.values(payload).filter(value => value).length
                                    ).forEach(
                                        payload =>
                                            bulk.find({
                                                _id: MongoDB.IDRegex.test(id) ? MongoDB.ObjectID(id) : id
                                            }).updateOne(payload)
                                    )

                                }
                            )
                            await bulk.execute()
                            return keys.map(a => true)
                        },
                        {
                            cache: false
                        }
                    )

                    break

        }

    return loaders[key][database][collection]
}

export default class Batch {
    static load(id, collection, database = 'default') {

        return getLoader('load', collection, database).then(
            loader =>
                loader.load(`${id}`)
        )

    }
    static loadMany(ids, collection, database = 'default') {

        return getLoader('load', collection, database).then(
            loader =>
                loader.loadMany(ids || [])
        )

    }
    static clear(id, collection, database = 'default') {

        return getLoader('load', collection, database).then(
            loader =>
                loader.clear(`${id}`)
        )

    }
    static loadAll(query, collection, database = 'default') {

        return getLoader('loadAll', collection, database).then(
            loader =>
                loader.load(query || {})
        )

    }
    static count(query, collection, database = 'default') {

        return getLoader('count', collection, database).then(
            loader =>
                loader.load(query || {})
        )

    }
    static insert(object, collection, database = 'default') {

        return getLoader('insert', collection, database).then(
            loader =>
                loader.load(object)
        )

    }
    static update(id, payload, collection, database = 'default') {

        return getLoader('update', collection, database).then(
            loader =>
                loader.load([id, payload])
        )

    }
}