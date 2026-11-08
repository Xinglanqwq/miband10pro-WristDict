# Release

| 文件 | 说明 |
|---|---|
| `com.band.wristdict.release.1.0.0.rpk` | 已签名的发布包（约 272 KB），可直接通过小米运动健康 Debug 安装 |
| `SHA256SUMS.txt` | 校验和 |

## 安装

1. 手机安装**小米运动健康**并连接手环；
2. 「我的 → 关于 → Debug → 第三方应用」；
3. 输入包名 `com.band.wristdict`，选择 `Install third app`，选中本目录的 rpk。

> 这个包使用本项目 `sign/` 下的证书签名。**自己重新打包时请生成自己的证书**，
> 否则和其他人的包签名相同会互相覆盖。

## 校验

```bash
sha256sum -c SHA256SUMS.txt
```
