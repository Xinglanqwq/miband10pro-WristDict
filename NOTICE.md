# 第三方数据与许可

本项目的**代码**以 MIT 许可发布（见 `LICENSE`）。
但 `src/common/dict-en.js`、`src/common/dict-zh.js` 以及 `preview/data/` 下的同名文件是**词典数据**，
属于第三方数据的衍生作品，遵循上游许可，不适用 MIT。

## 英汉数据

- 来源：[ECDICT](https://github.com/skywind3000/ECDICT)（作者 skywind3000）
- 许可：MIT
- 用途：英文词头、中文释义、词频、词形变化、考试标签
- 本项目做了裁剪（保留高频词）、去重、压缩为扁平字符串

ECDICT 的 MIT 许可原文见上游仓库。分发时请保留上述出处说明。

## 汉英数据

- 来源：[CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cedict)
- 许可：**CC BY-SA 4.0**（<https://creativecommons.org/licenses/by-sa/4.0/>）
- 用途：中文词条、拼音、英文释义
- 本项目按词频裁剪，并补充了拼音检索用的无声调键与首字母索引

> 因此 `dict-zh.js`（以及由它生成的预览数据）作为衍生作品，按 **CC BY-SA 4.0** 分发。
> 转载、修改、再分发时需保留署名（CC-CEDICT / MDBG）并以相同许可共享。

## 中文词频

- 来源：[jieba](https://github.com/fxsjy/jieba)（作者 fxsjy）
- 许可：MIT
- 用途：中文词条的常用度排序与裁剪阈值

## 说明

若你只使用本项目的**代码**（`src/pages/`、`src/common/search.js`、`src/common/store.js`、`tools/`、`preview/` 的脚本等），
可以只遵守 MIT；一旦连带分发词典数据文件，就需要同时满足上面的 CC BY-SA 4.0 要求。
