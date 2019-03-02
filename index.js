#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
// 制作命令行工具
const program = require('commander')
// markdown 转 html (markdown解析器)
const marked = require('marked');
// 语法高亮
const highlight = require('highlight.js');

const ejs = require('ejs');

const {
  defaultCss,
  mdCss,
  defaultHtml
} = require('./config');

const renderer = new marked.Renderer();
// 初步边侧栏数据
let siderDataArray = [];
// 记录当前标题的处于哪个级别
let counter = [null, 0, 0, 0, 0, 0, 0]
// 记录上一个标题的等级
let preLevel = 1

renderer.heading = (text, level, raw, slugger) => {
  // 保存当前标题的等级，用于最后更新preLevel
  const constantLevel = level
  // 临时存放当前标题等级的数组，倒序的，最后要反转
  const temperArr = []
  // 当前标题等级
  counter[level] = counter[level] + 1
  // 判断当前等级与上一个等级级别，如果级别低于上一个等级，则将高级别的值重置
  if (level < preLevel) {
    let tempLevel = preLevel
    // 循环去重置
    while (tempLevel - level > 0) {
      counter[tempLevel] = 0
      tempLevel--;
    }
  }
  // 循环更新成当前级别
  while (level > 0) {
    temperArr.push(counter[level])
    level--;
  }
  preLevel = constantLevel
  // 生成正确的等级树id
  const id = temperArr.reverse().join('-');
  // 初步边侧栏数据
  siderDataArray.push({
    id,
    text: raw
  })
  return `<h${constantLevel} id="${id}">${text}</h${constantLevel}>`;
}

// 设置marked 支持语法高亮 借用highlight.js
marked.setOptions({
  renderer: renderer,
  highlight: (code) => {
    return highlight.highlightAuto(code).value;
  },
  pedantic: false,
  gfm: true,
  tables: true,
  breaks: false,
  sanitize: false,
  smartLists: true,
  smartypants: false,
  xhtml: false
})
// 读取模板html文件
const templateHtml = fs.readFileSync(defaultHtml, {
  encoding: 'utf8'
})
// 读取默认css文件
const cssFile = fs.readFileSync(defaultCss, {
  encoding: 'utf8'
})
// 读取markdown样式
const mdCssFile = fs.readFileSync(mdCss, {
  encoding: 'utf8'
})

const template = ejs.compile(templateHtml, {
  client: true
})

program.version('0.0.1', '-v, --version')
  .option('-f --file <filePath>', 'file path')
  // .option('-d --dir <dirPath>', 'dir path')
  .option('-n --name <htmlName>', 'html name')
  .option('-o, --output <path>', 'output path, default current path')
  // .option('-c --css <filePath>', 'css file path')
  // .option('-l --list', 'List')
  .parse(process.argv);

if (program.file) {
  // 要转换的md
  const inputPath = program.file;
  // 输出的路径
  const output = program.output || './'
  // 文件名
  let name = program.name;
  if (typeof name !== 'string') {
    name = path.basename(inputPath).replace(path.extname(inputPath), '')
  } else {
    name = path.basename(name).replace(path.extname(name), '')
  }
  fs.readFile(inputPath, (err, file) => {
    if (err) {
      return console.error(err)
    }
    const mdCompile = mdToHtml(file.toString())
    const sider = arrayToSider(siderDataArray)
    // 将数据插入template.html
    const html = template({
      html: mdCompile,
      css: cssFile,
      mdCss: mdCssFile,
      sider
    })
    const outputPathAndName = path.join(output, `${name}.html`)
    // 生成html
    fs.writeFile(outputPathAndName, html, (err) => {
      if (err) {
        return console.error(err)
      }
    })
  })
}
// if (program.dir) console.log('dir');
// if (program.list) console.log('list');

// markdown 转 html
function mdToHtml(mdString) {
  return marked(mdString);
}
let siderArray = []
// 根据标题数组生成目录
function arrayToSider(arr) {
  // 遍历各个标题
  arr.map(el => {
    // 将每个标题拆分成等级数组
    const level = el.id.split('-')
    // 每个标题根据等级数组最后生成sider数据数组
    cycle(level, el)
  })
  return siderArray
}
// 循环生成最后的sider数据数组
function cycle(arr = [], currentTitle) {
  // 当前标题的数据
  const { id, text } = currentTitle
  // 上次循环存的等级
  let subIndex = null;
  let arrLength = arr.length
  arr.forEach((el ,index) => {
    if (index === 0) {
      if (arrLength === 1) {
        siderArray[el - 1] = { id, text, children: [] }
      } else {
        if (el - 1 < 0) {
          siderArray.push({id: '', text: '-', children: []})
        }
      }

        // 初始化上次的等级，因为这个一级标题，没有上级
      subIndex = null
    } else if (index === 1) {
      if (arrLength === 2) {
        siderArray[siderArray.length - 1].children.push({ id, text, children: [] })
      } else {
        siderArray[siderArray.length - 1].children.push({ id: '', text: '-', children: [] })
      }
        // 更新到这次遍历的等级
      subIndex = siderArray[siderArray.length - 1].children
    } else {
      if (arrLength === index + 1) {
        subIndex[subIndex.length - 1].children.push({ id, text, children: [] })
      } else {
        subIndex[subIndex.length - 1].children.push({ id: '', text: '-', children: [] })
      }
      subIndex = subIndex[subIndex.length - 1].children
    }
  });
}
