const fs = require('fs');
const http = require('http');
const querystring = require('querystring');

/**
 * url - {string} 数据文件路径或数据请求地址；当前数据请求地址，仅支持SuperMap iServer 数据服务地址；如：
 *            127.0.0.1:8090/iserver/services/data-osm/rest/data/
 * exportFileCount - {number} 数据导出文件数
 * options - {Object} 可选参数，包括以下：<br>
 *           featuresCount - {number} 需要处理的features 个数, 不得超过给定数据文件或请求地址中所保存features 的最大值，默认为全部处理。<br>
 *           isCompress - {boolean} 是否对数据输出数据压缩为流得形式。默认为 true, 即进行压缩<br>
 *           datasetNames - {string} 请求数据时，请求数据集对象名，如： 'osm:roads'。当 url 为数据地址时，必填。<br>
 *           isAverageStorage - {boolean} 是否需要将数据平均存储到每个文件。默认false。
 */
const clipToolForECharts = {

    datasetArray: [],

    process: function (parameters) {

        this.isShowLog = parameters.isShowLog ? parameters.isShowLog : false;

        //初始参数处理
        this.url = parameters.url;
        this.exportFileCount = parameters.exportFileCount;
        this.featuresCount = (parameters.options && parameters.options.featuresCount) ? parameters.options.featuresCount : null;
        this.isCompress =  parameters.options.isCompress ? parameters.options.isCompress : false;
        this.isAverageStorage = (parameters.options && parameters.options.isAverageStorage) ? parameters.options.isAverageStorage : false;

        //datasetNames 请求服务时使用
        this.datasetNames = (parameters.options && parameters.options.datasetNames) ? parameters.options.datasetNames : null;

        //根据 exportFileCount 创建文件和存储数组
        this._createStorageFile();

        const reg = /^((https|http)?:\/\/)/;
        if (reg.test(this.url)) {
            //url 为数据地址则启用请求数据
            this.readDataFromUrl();
        } else {
            //url 为文件地址则启用读取数据
            this.readDataFromFile();
        }
    },
    /**
     * @function PrepareBigDataForEcharts.prototype.readData
     * @description 文件读取形式获取并处理数据
     */
    readDataFromFile: function () {
        const me = this;
        me.isReadDatas = true;

        fs.readFile(me.url, 'utf8', (err, data) => {
            if (err) {
                return console.error(err);
            }
            if (JSON.parse(data)) {
                const dataTemp = JSON.parse(data);
                //若 featuresCount 没有配置，则默认当前最大值
                if (!me.featuresCount) {
                    me.featuresCount = dataTemp.features.length;
                }
                if (me.featuresCount <= 1000) {
                    me._prepareData(dataTemp);
                } else {
                    //因为iServer 每次只允许请求1000个features,
                    const integer = parseInt(me.featuresCount / 1000);
                    const remainder = me.featuresCount % 1000;

                    me.requestCount = integer + 1;
                    let startID = 0, endID = 1000;
                    for (let i = 0; i <= integer + 1;) {
                        let tempFeatures = dataTemp.features.slice(startID, endID);
                        me._prepareData({
                            "features": tempFeatures
                        });
                        i++;
                        me.requestCount--;
                        startID = endID;
                        if (i === integer + 1) {
                            if (remainder === 0) {
                                break;
                            }
                            endID += remainder;
                        } else {
                            endID = 1000 * i;
                        }
                    }
                }
            }
        });
    },

    /**
     * @function PrepareBigDataForEcharts.prototype.processAsync
     * @description 请求服务的形式获取并处理数据
     */
    readDataFromUrl: function () {
        const me = this;

        //请求地址拆分处理
        const parse_url = /^(?:([A-Za-z]+):)?(\/{0,3})([0-9.\-A-Za-z]+)(?::(\d+))?(?:\/([^?#]*))?(?:\?([^#]*))?(?:#(.*))?$/;
        const urlSplit = parse_url.exec(me.url);

        me.urlHost = urlSplit[3];
        me.urlPort = Number(urlSplit[4]);
        me.urlPath = urlSplit[5];

        if (!me.datasetNames) {
            return Error("datasetNames undefined");
        }
        me.datasetNamesArray = me.datasetNames.split(':');

        //请求参数处理，若 featuresCount 有值则直接按 featuresCount 进行发请求准备，若没有值，则请求当前服务存储 features 数，按存储数处理:
        if (!me.featuresCount) {
            me._requestFeaturesCounts();
        } else {
            me._prepareRequest();
        }

    },

    _prepareRequest: function () {
        const me = this;
        let post_data;
        if (me.featuresCount < 1000) {
            me.requestCount = 1;
            post_data = JSON.stringify({
                'datasetNames': [me.datasetNames],
                'getFeatureMode': "SQL",
                'queryParameter': {'name': me.datasetNamesArray[1], 'attributeFilter': `SmID<=${me.featuresCount}`}
            });
            me._requestDataset(post_data);
        } else {
            //因为iServer 每次只允许请求1000个features,
            const integer = parseInt(me.featuresCount / 1000);
            const remainder = me.featuresCount % 1000;

            if (remainder === 0) {
                me.requestCount = integer;
            } else {
                me.requestCount = integer + 1;
            }
            let startID = 0, endID = 1000;
            for (let i = 1; i <= integer + 1;) {
                post_data = JSON.stringify({
                    'datasetNames': [me.datasetNames],
                    'getFeatureMode': "SQL",
                    'queryParameter': {
                        'name': me.datasetNamesArray[1],
                        'attributeFilter': `SmID >${startID} And SmID<=${endID}`
                    }
                });
                me._requestDataset(post_data);
                i++;
                startID = endID;
                if (i === integer + 1) {
                    if (remainder === 0) {
                        break;
                    }
                    endID += remainder;
                } else {
                    endID = 1000 * i;
                }
            }
        }
    },

    _requestDataset: function (post_data) {
        const me = this;
        const options = {
            host: this.urlHost,    //此处不能写协议，如 ： http://,https://  否则会报错
            port: this.urlPort,
            path: '/' + this.urlPath + '/featureResults.json?returnContent=true',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': post_data.length
            }
        };
        const req = http.request(options, (res) => {
            res.setEncoding('utf8');
            let results = "";
            res.on('data', (chunk) => {
                results += chunk;
            });
            res.on('end', () => {
                req.end('success');
                me.requestCount--;
                me._prepareData(JSON.parse(results));
            });

        });

        // write data to request body
        req.write(post_data);

    },

    _requestFeaturesCounts: function () {
        const me = this;
        let featuresUrl = me.url + '/datasources/' + me.datasetNamesArray[0] + '/datasets/' + me.datasetNamesArray[1] + '/features.json';
        http.get(featuresUrl, function (req, res) {
            let results = '';
            req.on('data', function (data) {
                results += data;
            });
            req.on('end', function () {
                me.featuresCount = JSON.parse(results).featureCount;
                me._prepareRequest();
            });
        });
    },

    _createStorageFile: function () {
        //读取当前是否已经创建了文件目录：
        const me = this;
        fs.readdir('./resultData', (err, files) => {
            if (err) {
                fs.mkdir("./resultData/", (err) => {
                    if (err) {
                        return console.error(err);
                    }
                    if (me.isShowLog) {
                        console.log("The directory was created successfully.");
                    }
                    createFilePathCallback();
                });
                return
            }

            if (me.isShowLog) {
                console.log("Directory already exists.");
            }
            //若已经存在数据文件，则先进行清除操作
            files.forEach(function (file) {
                fs.unlinkSync('./resultData/' + file, (err) => {
                    if (err) {
                        return console.error(err);
                    }
                });
            });
            createFilePathCallback();
        });

        //创建存储文件夹，以及数组：
        function createFilePathCallback() {
            if (me.exportFileCount) {
                let fileType;
                if (me.isCompress) {
                    fileType = 'bin'
                } else {
                    fileType = 'json'
                }
                for (let num = 0; num < me.exportFileCount; num++) {
                    fs.createWriteStream(`./resultData/data_${num}.${fileType}`);
                    //创建将要存入每个文件夹下的数组：
                    me.datasetArray.push([]);
                }
            }
        }

    },

    _prepareData: function (prepareData) {
        const me = this;
        let features;
        if (prepareData['features']) {
            features = prepareData['features'];
            let featuresCounts = features.length;

            //遍历每个features并存顺序均匀存储到数组
            for (let i = 0; i < featuresCounts; i++) {
                let points;
                //支持eoJSON格式和SuperMap iServer JSON 数据格式。
                if (features[i].geometry.points) {
                    points = features[i].geometry.points;
                } else if (features[i].geometry.coordinates) {
                    points = features[i].geometry.coordinates;
                }

                let dataType = me.dataType = features[i].geometry.type;
                dataType = dataType.toLowerCase();
                //处理两种数据类型：
                if (dataType === 'point') {
                    //数据类型为点则直接随机存入数组
                    let index = Math.floor(Math.random() * me.datasetArray.length);
                    if (points[0].x && points[0].y) {
                        me.datasetArray[index].push(points[0].x);
                        me.datasetArray[index].push(points[0].y);
                        return;
                    }
                    me.datasetArray[index].push(points[0]);
                    me.datasetArray[index].push(points[1]);

                } else if (dataType === 'line' || dataType === 'linestring' || dataType === 'multilinestring') {
                    if (features[i].geometry.parts || dataType === 'multilinestring') {
                        let parts, partsPoints;
                        //处理 ‌multilinestring
                        if (dataType === 'multilinestring') {
                            for (let p = 0; p < points.length; p++) {
                                //按 parts切割子对象：
                                partsPoints = points[p];
                                //每个 parts 子对象分别切割存储：
                                _sliceLines(partsPoints);
                            }
                        } else {
                            //处理 parts
                            parts = features[i].geometry.parts;
                            let startParts = 0;
                            for (let p = 0; p < parts.length; p++) {
                                //按 parts切割子对象：
                                partsPoints = points.slice(startParts, parts[p]);
                                //每个 parts 子对象分别切割存储：
                                _sliceLines(partsPoints);
                                startParts = parts[p];
                            }
                        }

                    } else {
                        _sliceLines(points);
                    }

                } else {
                    return new Error("数据格式不支持。");
                }
            }
        }

        function _sliceLines(points) {
            //一条线存储的文件下至少两个点，即一条线段
            let off = 0;
            let integer = parseInt((points.length - 1) / me.exportFileCount);
            let remainder = (points.length - 1) % me.exportFileCount;

            //余下的点随机存入某个文件下，为了保证每个均匀存入数据
            let isSaveRemainderArr = new Array(me.exportFileCount);
            //trueArr 为了避免
            let trueArr = {};
            for (let i = 0; i < remainder;) {
                let index = Math.floor(Math.random() * isSaveRemainderArr.length);
                //若该元素已经被设置为 true,则重新遍历
                if (trueArr[index])
                    continue;

                isSaveRemainderArr[index] = true;
                trueArr[index] = true;
                i++
            }
            if (integer === 0) {
                //则每个文件存两个点，直到存完点
                //便利存入points.length - 1个文件下，每个文件存一个线段
                let keys = Object.keys(trueArr);

                for (let y = 0; y < keys.length; y++, off++) {
                    //每个存入两个点，即存入一条线段
                    let index;
                    //是否需要平均存储
                    if (me.isAverageStorage) {
                        index = Number(keys[y]);
                    } else {
                        index = y;
                    }
                    me.datasetArray[index].push(2);
                    for (let k = 0; k < 2; k++) {

                        //每个文件结着上一个文件存的最后一个点存储
                        let pointTemp = points[off + k];
                        if (pointTemp.x && pointTemp.y) {
                            me.datasetArray[index].push(pointTemp.x);
                            me.datasetArray[index].push(pointTemp.y);
                            return;
                        }
                        me.datasetArray[index].push(pointTemp[0]);
                        me.datasetArray[index].push(pointTemp[1]);
                    }
                }
            } else {
                //当每个文件都至少能存储一条线段时，先算出每个文件存几个线段：
                for (let y = 0; y < me.exportFileCount; y++) {
                    let count;
                    //存储点数目：
                    //是否需要平均存储：
                    if (me.isAverageStorage && isSaveRemainderArr[y] === true) {
                        count = integer + 1 + 1;
                        me.datasetArray[y].push(count);
                    } else if (!me.isAverageStorage && remainder > 0) {
                        count = integer + 1 + 1;
                        me.datasetArray[y].push(count);
                        remainder--;
                    } else {
                        count = integer + 1;
                        me.datasetArray[y].push(count);
                    }
                    //存储点坐标：
                    for (let k = 0; k < count; k++) {
                        let pointTemp;
                        //保证每个文件里面存储得该线得第一点一定连接上个文件存储得同一条线段：
                        if (k === 0) {
                            pointTemp = points[off];
                        } else {
                            pointTemp = points[++off];
                        }
                        if (pointTemp.x && pointTemp.y) {
                            me.datasetArray[y].push(pointTemp.x);
                            me.datasetArray[y].push(pointTemp.y);
                        } else {
                            me.datasetArray[y].push(pointTemp[0]);
                            me.datasetArray[y].push(pointTemp[1]);
                        }

                    }

                }
            }
        }

        if (me.requestCount === 0) {
            me._writeDataToFile();
        }
    },

    _writeDataToFile: function () {
        //若 isCompress 为true,则将数据处理为流得形式存储
        if (this.isCompress) {
            for (let i = 0; i < this.exportFileCount; i++) {
                let data = new Float32Array(this.datasetArray[i]);
                let buffer = new Buffer(data.length * 4);
                for (let y = 0; y < this.datasetArray[i].length; y++) {
                    buffer.writeFloatLE(data[y], y * 4);
                }

                fs.writeFile(`./resultData/data_${i}.bin`, buffer, (err) => {
                    if (err) {
                        console.log(err);
                        return;
                    }
                    if (this.isShowLog) {
                        console.log(`./resultData/data_${i}.bin` + "data's writing successfully!");
                    }
                })
            }
            return;
        }

        //将处理好得数据分别存入文件
        for (let i = 0; i < this.exportFileCount; i++) {

            fs.writeFile(`./resultData/data_${i}.json`, JSON.stringify(this.datasetArray[i]), (err) => {
                if (err) {
                    console.log(err);
                    return;
                }
                if (this.isShowLog) {
                    console.log(`./resultData/data_${i}.json` + "data's writing successfully!")
                }

            })
        }
    }

};

const parameters = require('./config');

const options = process.argv.splice(2);

if (options && options[0] === '--log') {
    parameters.isShowLog = true;
}
clipToolForECharts.process(parameters);
