(function(factory){
	if(window.define && define instanceof Function){
		define(factory);
	}else{
		window.Pic2txt = factory();
	}
})(function(require,exports){
	var CANVAS
		,C2;

	// @todo 动画
	// @todo 图片数据缓存(indexedDB)
	// @todo 操作ui界面

	function Pic2txt(config){
		this.config = {
			// 图片队列，有多个的话则会按顺序执行
			"srcs":["pic/raid.gif"]
			// 图形队列
			,"symbols":["#","&","$","*","o","○",";","&"," ",":",";"]
			// 灰度分割等级
			// Math.ceil(灰度256阶/分割等级)
			,"lv":10
			// 相当每个点的高度
			// 值越小则分割出来的行数越大，生成的图案越大
			,"pointHeight":6
			// 刷新率，影响动画的流畅度
			,"fps":30
			// 输出到控制台
			,"log":1
		}

		if(config && config instanceof Object){
			for(var n in config){
				this.config[n] = config[n];
			}
		}

		// 用来加载图片资源的图片对象
		this.$img = new Image();
		// 图片加载事件
		this.$img.onload = this.onImgLoad.bind(this);
		// 当前图片对象
		this.$nowImg = null;
		// 当前图片位于队列中的索引
		this.$nowIndex = 0;

		// 已生成的文本资源数据
		this.$data = {};

		// 当前图片对应的文本数据
		this.$nowTxt = null;

		// 灰阶等级对应关系表
		this.$lvMap = {};
		// 灰阶对应的图案
		this.$lvSymbols = this.config.symbols;
		// 每一阶灰阶的数值
		this.$lvSetp = 0;

		// 显示队列
		this.$queue = this.config.srcs || [];
		// 显示的总数量
		this.$length = this.$queue.length;

		// 当前处理状态
		this.$busy = 0;

		// 模块状态
		this.ready = 0;

		this.init();
	}

	Pic2txt.prototype.init = function(){
		if(!CANVAS){
			// 生个canvas备用
			CANVAS = document.createElement("canvas");
			C2 = CANVAS.getContext("2d");
		}

		this.$c = CANVAS;
		this.$c2 = C2;

		// 计算每阶的数值
		var setp = Math.ceil(256/this.config.lv);
		// 生成灰阶
		for(var i = 0;i<this.config.lv;i++){
			this.$lvMap[i] = setp*(i+1);
		}
		this.$lvSetp = setp;

		this.ready = 1;

		if(this.$length){
			this.go();
		}
	}

	/**
	 * 执行某一帧?
	 * @param  {Number}    i 帧索引
	 * @return {Undefined}   无返回值
	 */
	Pic2txt.prototype.go = function(i){
		if(!isNaN(i) && i < this.$length){
			this.$nowIndex = i;
		}
		if(!this.$length){
			return;
		}
		if(!this.$data[this.$nowIndex]){
			// 加载图片
			this.$img.src = this.$queue[this.$nowIndex];
		}else{
			this.refresh();
		}
	}

	/**
	 * 图片加载完成响应函数
	 * @return {Undefined} 无返回值
	 */
	Pic2txt.prototype.onImgLoad = function(){
		this.refresh();
	}

	/**
	 * 刷新当前的图
	 * @return {String} 图片转化后的字符串对象
	 */
	Pic2txt.prototype.refresh = function(){
		if(this.$busy){
			return;
		}
		this.$busy = 1;

		if(!this.$data[this.$nowIndex]){
			// 还没生成过
			var w = this.$img.width		// 当前图片宽度
				,h = this.$img.height	// 当前图片高度
				,dat;					// 当前图片的图片数据对象

			this.$c.width = w;
			this.$c.height = h;

			// 加载图片到canvas
			this.$c2.drawImage(this.$img,0,0);
			// 获取图片数据
			dat = this.$c2.getImageData(0,0,w,h);

			// 图片对应的点阵数组
			dat = dat.data;

			var line							// 每行
				,colorIndex						// 每个绘画点的索引值
				,pic = ''						// 图片转化后的字符串对象
				,ph = this.config.pointHeight	// 相当于每个点的高度
				,pw = Math.round(ph/2);			// 相当于每个点的宽度

			for(var i = 0;i < h;i += ph){
				// 每行的间隔
				line = '';
				for(var j = 0;j < w;j += pw){
					// 每行的每个点相隔
					// 每个点分rgba，所以是x4
					colorIndex = (j+w*i)*4;

					// 转成文本
					line += this.getGrayTxt(
						// 转成灰度
						this.getGray(
							dat[colorIndex + 0]
							,dat[colorIndex + 1]
							,dat[colorIndex + 2]
						)
					);
				}
				line += '\n';
				pic += line;
			}

			this.$nowTxt = pic;
			this.$data[this.$nowIndex] = pic;

			w = h = ph = pw = dat = line = pic = colorIndex = null;
		}else{
			this.$nowTxt = this.$data[this.$nowIndex];
		}

		this.$busy = 0;

		if(this.config.log){
			console.log(this.$nowTxt);
		}

		return this.$nowTxt;
	}

	/**
	 * 灰度转对应的图案
	 * @param  {Number} gray 灰度数值
	 * @return {String}      灰度对应的文本图案
	 */
	Pic2txt.prototype.getGrayTxt = function(gray){
		return this.$lvSymbols[
			this.getLv(gray)
		];
	}

	/**
	 * 获取对应的灰度等级(灰阶？)
	 * @param  {Number} gray 灰度值
	 * @return {Number}      灰阶值
	 */
	Pic2txt.prototype.getLv = function(gray){
		for(var i = 0;i<this.config.lv;i++){
			if(i){
				if(i+1 < this.config.lv && gray > this.$lvMap[i] && gray <= this.$lvMap[i+1]){
					break;
				}
			}else if(!i && gray <= this.$lvMap[i]){
				break;
			}
		}
		return i;
	}

	/**
	 * RBG值转灰度
	 * @param  {Number} r 红
	 * @param  {Number} g 绿
	 * @param  {Number} b 蓝
	 * @return {Number}   对应的灰度值
	 * @todo              3个算法的效率对比
	 */
	Pic2txt.prototype.getGray = function(r,g,b){
		// base: r*0.299 + g*0.587 + b*0.114
		// 32: (r*30 + g*59 + b*11 + 50)/100
		// (r*38 + g*75 + b*15) >> 7;
		return (r*38 + g*75 + b*15) >> 7;
	}

	if(exports){
		exports.base = Pic2txt;
	}else{
		return Pic2txt;
	}
});