# Clip Tool for ECharts

Clip Tool for ECharts 是一个基于 node 的大数据切割工具，用于将点数据和线数据切割、存储，以支持 ECharts 大数据量（百万以上）的渲染场景。

## 用法

* 第一步：配置 [config.json](#config) 文件

* 第二步：运行 `node` 命令 `$ npm start`

<h2 id='config'>config.json</h2>

`config.json` 配置文件示例与参数介绍如下：
``` javascript
{
  "url": "http://127.0.0.1:8090/iserver/services/data-beijingroads/rest/data",
  "exportFileCount": 10,
  "options": {
    "featuresCount": 60364,
    "isCompress": true,
    "datasetNames": "beijingroads:point", 
    "isAverageStorage": true
  }
}
```
 必填参数
* url: 数据来源URL。
  * 支持的数据来源
    * GeoJSON 格式文件
    ``` javascript
    //GeoJSON 数据格式示例：
    ｛"features": [{
            "type": "Feature",
            "geometry": {
               "type": "Point", // 或者为 "LineString"
               "coordinates": [[-47.8977476573595,-15.792110943058866]
               ]
            }
       ]
    ｝
    ```
    *  SuperMap iServer Rest 数据服务
    ``` javascript
    http://support.supermap.com.cn:8090/iserver/services/data-world/rest/data
    ```
    *  SuperMap iServer JSON 格式文件
    ``` javascript
    //SuperMap iServer JSON数据格式示例:
    {"features": [{
           "geometry": {
              "parts": [1],
              "type": "POINT", // 或者为 "LINE"
              "points": [{
                    "x": -47.8977476573595,
                    "y": -15.792110943058866
                  }
              ]
           }
      ]
    }
    ```
  * 支持的数据类型
    * 点
    * 线
    
* exportFileCount: 输出的文件数。

可选参数
* options.featuresCount: 切割的要素个数，默认为所有features。
* options.isCompress: 文件是否压缩存储。true 则压缩，数据将存为 *.bin 格式，false 则不压缩，数据将存为 *.json 格式。默认为 true。
* options.datasetNames: 切割的数据集名称，当 "url" 为数据服务地址时，必须指定该参数。
* options.isAverageStorage: 是否将数据平均存入文件。true 则平均存储，输出的每个文件大小相近；false 则不平均存储，输出文件大小将依次递减，默认为 false。


## Samples

* 加载数据效果示例如下：

 [![](http://iclient.supermap.io/dev/examples/mapboxgl/img/mb_echartsLinesMillionsWaterSystem.png)](http://iclient.supermap.io/examples/mapboxgl/editor.html#echarts_linesDrawMillionsWaterSystem)
 
 [![](http://iclient.supermap.io/dev/examples/leaflet/img/l_echartsLinesMillionsRoads.png)](http://iclient.supermap.io/examples/leaflet/editor.html#echarts_linesDrawMillionsRoadsNetwork_50WFeatures)
 
 [![](http://iclient.supermap.io/dev/examples/openlayers/img/ol_echartsLinesMillionsBeijingRoads.png)](http://iclient.supermap.io/examples/openlayers/editor.html#echarts_linesDrawMillionsBeijingRoadsNetwork)

 
## 许可
