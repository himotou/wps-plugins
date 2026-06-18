import Util from '../js/util.js'

/* global wps:false */

var ribbon = {
    selectionListenerRegistered: false,
    selectionChangeHandler: null,
    selectionCacheKey: "link_bind_last_selection_context",

    OnAddinLoad: function(ribbonUI) {
        if (typeof (window.Application.ribbonUI) != "object") {
            window.Application.ribbonUI = ribbonUI
        }

        if (typeof (window.Application.Enum) != "object") {
            window.Application.Enum = Util.WPS_Enum
        }

        window.ribbon = ribbon
        this.clearStoredSelectionContext()
        this.initializeSelectionTracking()
        return true
    },

    OnAction: function(control) {
        if (control.Id === "btnSetHyperlink") {
            const context = this.captureSelectionContext()

            if (!context) {
                return true
            }

            window.Application.PluginStorage.setItem("link_bind_context", JSON.stringify(context))
            window.Application.ShowDialog(
                Util.AppendQuery(Util.BuildRouteUrl("/dialog/hyperlink"), { _ts: String(Date.now()) }),
                "设置超链接",
                520 * window.devicePixelRatio,
                360 * window.devicePixelRatio,
                false
            )
        }

        return true
    },

    captureSelectionContext: function() {
        try {
            const presentation = window.Application.ActivePresentation
            if (!presentation) {
                alert("当前没有打开任何文档")
                return null
            }

            const liveSelectionContext = this.buildSelectionContext(this.getActiveSelection(), true)
            if (this.isConfirmedSelectionContext(liveSelectionContext)) {
                this.storeCachedSelectionContext(liveSelectionContext)
                return this.normalizeDialogContext(liveSelectionContext)
            }

            const liveCursorContext = this.toCursorDialogContext(liveSelectionContext)
            const cachedContext = this.getCachedSelectionContext()
            if (this.isConfirmedSelectionContext(cachedContext)) {
                return this.normalizeDialogContext(cachedContext)
            }

            return liveCursorContext
        } catch (error) {
            console.error("获取选区失败:", error)
            alert("读取当前选区失败，请重新选中文本后再试。")
            return null
        }
    },

    initializeSelectionTracking: function() {
        if (this.selectionListenerRegistered) {
            this.refreshSelectionContextCache()
            return
        }

        try {
            if (window.Application.ApiEvent && typeof window.Application.ApiEvent.AddApiEventListener === "function") {
                this.selectionChangeHandler = this.selectionChangeHandler || this.OnWindowSelectionChange.bind(this)
                window.Application.ApiEvent.AddApiEventListener("WindowSelectionChange", this.selectionChangeHandler)
                this.selectionListenerRegistered = true
            }
        } catch (error) {
            console.log("注册选区监听失败:", error)
        }

        this.refreshSelectionContextCache()
    },

    refreshSelectionContextCache: function() {
        try {
            const context = this.buildSelectionContext(this.getActiveSelection(), false)
            if (context) {
                this.storeCachedSelectionContext(context)
            }
        } catch (error) {
            console.log("刷新选区缓存失败:", error)
        }
    },

    OnWindowSelectionChange: function(selection) {
        try {
            const context = this.buildSelectionContext(selection, true)
            if (context) {
                this.storeCachedSelectionContext(context)
            }
        } catch (error) {
            console.log("记录选区变化失败:", error)
        }
    },

    isConfirmedSelectionContext: function(context) {
        return !!context
            && context.mode === "selection"
            && context.confirmedSelection === true
            && typeof context.length === "number"
            && context.length > 0
            && typeof context.text === "string"
            && context.text !== ""
    },

    buildSelectionContext: function(selection, isConfirmedSelection) {
        if (!selection) {
            return {
                ...this.buildCursorContext(null, null),
                updatedAt: Date.now(),
                confirmedSelection: false
            }
        }

        const textRange = this.getSelectionTextRange(selection)
        const ownerShape = this.getOwnerShape(selection, textRange)
        const textSelectionState = this.normalizeSelectionState(
            this.getTextSelectionState(textRange),
            ownerShape
        )
        const activeSlideId = this.getActiveSlideId(selection, textRange)
        const activeShapeId = this.getActiveShapeId(selection, textRange)
        const selectionType = this.getSelectionType(selection)
        const explicitSelectionState = this.getExplicitSelectionState(selectionType, textSelectionState)

        if (!explicitSelectionState || !isConfirmedSelection) {
            return {
                ...this.buildCursorContext(selection, textRange),
                slideId: activeSlideId,
                shapeId: activeShapeId,
                updatedAt: Date.now(),
                confirmedSelection: false
            }
        }

        const hyperlink = this.readHyperlink(textRange)

        return {
            mode: "selection",
            text: explicitSelectionState.text,
            url: hyperlink.address,
            screenTip: hyperlink.screenTip,
            slideId: activeSlideId,
            shapeId: activeShapeId,
            start: explicitSelectionState.start,
            length: explicitSelectionState.length,
            selectionType: selectionType,
            updatedAt: Date.now(),
            confirmedSelection: true
        }
    },

    normalizeDialogContext: function(context) {
        if (!this.isConfirmedSelectionContext(context)) {
            return this.toCursorDialogContext(context)
        }

        return {
            mode: "selection",
            text: typeof context.text === "string" ? context.text : "",
            url: typeof context.url === "string" ? context.url : "",
            screenTip: typeof context.screenTip === "string" ? context.screenTip : "",
            slideId: typeof context.slideId === "number" ? context.slideId : 0,
            shapeId: context.shapeId || 0,
            start: typeof context.start === "number" ? context.start : 0,
            length: typeof context.length === "number" ? context.length : 0,
            selectionType: typeof context.selectionType === "number" ? context.selectionType : null
        }
    },

    toCursorDialogContext: function(context) {
        return {
            mode: "cursor",
            text: "",
            url: "",
            screenTip: "",
            slideId: context && typeof context.slideId === "number" ? context.slideId : 0,
            shapeId: context && (typeof context.shapeId === "number" || typeof context.shapeId === "string") ? context.shapeId : 0,
            start: 0,
            length: 0
        }
    },

    buildCursorContext: function(selection, textRange) {
        return {
            mode: "cursor",
            text: "",
            url: "",
            screenTip: "",
            slideId: this.getActiveSlideId(selection, textRange),
            shapeId: this.getActiveShapeId(selection, textRange),
            start: 0,
            length: 0
        }
    },

    storeCachedSelectionContext: function(context) {
        try {
            window.Application.PluginStorage.setItem(this.selectionCacheKey, JSON.stringify(context))
        } catch (error) {
            console.log("写入选区缓存失败:", error)
        }
    },

    getCachedSelectionContext: function() {
        try {
            const raw = window.Application.PluginStorage.getItem(this.selectionCacheKey)
            if (!raw) {
                return null
            }

            const context = JSON.parse(raw)
            if (!context || typeof context !== "object") {
                return null
            }

            if (context.mode !== "selection") {
                return {
                    ...this.buildCursorContext(null, null),
                    slideId: typeof context.slideId === "number" ? context.slideId : 0,
                    shapeId: context.shapeId || 0,
                    confirmedSelection: false,
                    updatedAt: typeof context.updatedAt === "number" ? context.updatedAt : 0
                }
            }

            return {
                mode: "selection",
                text: typeof context.text === "string" ? context.text : "",
                url: typeof context.url === "string" ? context.url : "",
                screenTip: typeof context.screenTip === "string" ? context.screenTip : "",
                slideId: typeof context.slideId === "number" ? context.slideId : 0,
                shapeId: context.shapeId || 0,
                start: typeof context.start === "number" ? context.start : 0,
                length: typeof context.length === "number" ? context.length : 0,
                selectionType: typeof context.selectionType === "number" ? context.selectionType : null,
                confirmedSelection: context.confirmedSelection === true,
                updatedAt: typeof context.updatedAt === "number" ? context.updatedAt : 0
            }
        } catch (error) {
            console.log("读取选区缓存失败:", error)
        }

        return null
    },

    getActiveSelection: function() {
        try {
            if (window.Application.ActiveWindow && window.Application.ActiveWindow.Selection) {
                return window.Application.ActiveWindow.Selection
            }
        } catch (error) {
            console.log("读取 ActiveWindow.Selection 失败:", error)
        }

        try {
            if (window.Application.Selection) {
                return window.Application.Selection
            }
        } catch (error) {
            console.log("读取 Application.Selection 失败:", error)
        }

        return null
    },

    getSelectionType: function(selection) {
        try {
            if (selection && typeof selection.Type === "number") {
                return selection.Type
            }
        } catch (error) {
            console.log("读取 Selection.Type 失败:", error)
        }

        return null
    },

    getSelectionTextRange: function(selection) {
        try {
            if (selection && selection.TextRange) {
                return selection.TextRange
            }
        } catch (error) {
            console.log("读取 TextRange 失败:", error)
        }

        return null
    },

    getTextSelectionState: function(textRange) {
        if (!textRange) {
            return {
                hasSelection: false,
                text: "",
                start: 0,
                length: 0
            }
        }

        const text = typeof textRange.Text === "string" ? textRange.Text : ""
        const start = typeof textRange.Start === "number" ? textRange.Start : 0
        const length = typeof textRange.Length === "number" ? textRange.Length : 0

        return {
            hasSelection: length > 0 && text !== "",
            text: length > 0 ? text : "",
            start: start,
            length: length
        }
    },

    normalizeSelectionState: function(selectionState, shape) {
        if (!selectionState || !selectionState.hasSelection) {
            return selectionState
        }

        try {
            if (!shape || !shape.TextFrame || !shape.TextFrame.TextRange) {
                return selectionState
            }

            const fullText = shape.TextFrame.TextRange.Text || ""
            if (!fullText) {
                return selectionState
            }

            const rawStart = typeof selectionState.start === "number" ? selectionState.start : 0
            const sliceStart = Math.max(0, Math.min(Math.max(rawStart - 1, 0), fullText.length))
            const sliceEnd = Math.max(sliceStart, Math.min(sliceStart + selectionState.length, fullText.length))
            const actualText = fullText.slice(sliceStart, sliceEnd)

            if (!actualText) {
                return selectionState
            }

            return {
                hasSelection: selectionState.length > 0,
                text: actualText,
                start: rawStart,
                length: sliceEnd - sliceStart
            }
        } catch (error) {
            console.log("校准选区文本失败:", error)
        }

        return selectionState
    },

    isPlaceholderSelectionState: function(selectionState) {
        if (!selectionState || !selectionState.hasSelection) {
            return false
        }

        return selectionState.text === "default"
    },

    getExplicitSelectionState: function(selectionType, textSelectionState) {
        const isTextSelection = selectionType === 3

        if (!isTextSelection) {
            return null
        }

        if (textSelectionState && textSelectionState.hasSelection && !this.isPlaceholderSelectionState(textSelectionState)) {
            return textSelectionState
        }

        return null
    },

    readHyperlink: function(textRange) {
        if (!textRange) {
            return { address: "", screenTip: "" }
        }

        try {
            if (textRange.Hyperlinks && textRange.Hyperlinks.Count > 0) {
                const hyperlink = textRange.Hyperlinks.Item(1)
                return {
                    address: hyperlink && hyperlink.Address ? hyperlink.Address : "",
                    screenTip: hyperlink && hyperlink.ScreenTip ? hyperlink.ScreenTip : ""
                }
            }
        } catch (error) {
            console.log("读取超链接失败:", error)
        }

        try {
            const actionSetting = textRange.ActionSettings.Item(this.getMouseClickEnum())
            if (actionSetting && actionSetting.Hyperlink && actionSetting.Hyperlink.Address) {
                return {
                    address: actionSetting.Hyperlink.Address || "",
                    screenTip: actionSetting.Hyperlink.ScreenTip || ""
                }
            }
        } catch (error) {
            console.log("读取 ActionSettings 超链接失败:", error)
        }

        return { address: "", screenTip: "" }
    },

    getActiveSlideId: function(selection, textRange) {
        try {
            if (selection && selection.SlideRange && selection.SlideRange.Count > 0) {
                const slide = selection.SlideRange.Item(1)
                return slide ? slide.SlideID : 0
            }

            const ownerShape = this.getOwnerShape(selection, textRange)
            const ownerSlideId = this.getSlideIdFromShape(ownerShape)
            if (ownerSlideId) {
                return ownerSlideId
            }

            const presentation = window.Application.ActivePresentation
            if (presentation && presentation.Slides && presentation.Slides.Count > 0) {
                const slide = presentation.Slides.Item(1)
                return slide ? slide.SlideID : 0
            }
        } catch (error) {
            console.log("获取幻灯片ID失败:", error)
        }

        return 0
    },

    getActiveShapeId: function(selection, textRange) {
        try {
            const ownerShape = this.getOwnerShape(selection, textRange)
            if (ownerShape && typeof ownerShape.Id === "number") {
                return ownerShape.Id
            }

            if (selection && selection.ShapeRange && selection.ShapeRange.Count > 0) {
                const shape = selection.ShapeRange.Item(1)
                return shape ? shape.Id : 0
            }
        } catch (error) {
            console.log("获取形状ID失败:", error)
        }

        return 0
    },

    getOwnerShape: function(selection, textRange) {
        try {
            if (selection && selection.HasChildShapeRange && selection.ChildShapeRange && selection.ChildShapeRange.Count > 0) {
                return selection.ChildShapeRange.Item(1)
            }
        } catch (error) {
            console.log("读取 ChildShapeRange 失败:", error)
        }

        try {
            if (textRange && textRange.Parent) {
                if (typeof textRange.Parent.Id === "number") {
                    return textRange.Parent
                }

                if (textRange.Parent.Parent && typeof textRange.Parent.Parent.Id === "number") {
                    return textRange.Parent.Parent
                }
            }
        } catch (error) {
            console.log("回溯文本所属形状失败:", error)
        }

        return null
    },

    getSlideIdFromShape: function(shape) {
        try {
            let current = shape
            for (let depth = 0; current && depth < 8; depth += 1) {
                if (current.Parent && typeof current.Parent.SlideID === "number") {
                    return current.Parent.SlideID
                }

                if (current.Parent && current.Parent.Parent && typeof current.Parent.Parent.SlideID === "number") {
                    return current.Parent.Parent.SlideID
                }

                current = current.Parent
            }
        } catch (error) {
            console.log("回溯形状所属幻灯片失败:", error)
        }

        return 0
    },

    applyHyperlink: function(payload) {
        try {
            const presentation = window.Application.ActivePresentation
            if (!presentation) {
                alert("当前没有打开任何文档")
                return false
            }

            const url = (payload && payload.url ? String(payload.url) : "").trim()
            const text = payload && typeof payload.text === "string" ? payload.text : ""
            const title = (payload && payload.title ? String(payload.title) : "").trim()
            const linkText = text || title || url
            const screenTip = title || url

            if (!url) {
                alert("请输入超链接地址")
                return false
            }

            const context = this.getStoredSelectionContext()
            if (!context) {
                return false
            }

            if (context.mode !== "selection") {
                alert("当前没有选中文字，请先选择要设置超链接的文本。")
                return false
            }

            const success = this.applyToMatchingLiveSelection(context, url, linkText, screenTip)
                || this.applyToStoredSelection(context, url, linkText, screenTip)

            if (success) {
                this.clearStoredSelectionContext()
            }

            return success
        } catch (error) {
            console.error("设置超链接失败:", error)
            alert("设置超链接失败：" + (error && error.message ? error.message : "未知错误"))
            return false
        }
    },

    getStoredSelectionContext: function() {
        try {
            const raw = window.Application.PluginStorage.getItem("link_bind_context")
            if (!raw) {
                return null
            }

            return JSON.parse(raw)
        } catch (error) {
            console.error("读取缓存选区失败:", error)
            return null
        }
    },

    clearStoredSelectionContext: function() {
        try {
            window.Application.PluginStorage.removeItem("link_bind_context")
        } catch (error) {
            try {
                window.Application.PluginStorage.setItem("link_bind_context", "")
            } catch (innerError) {
                console.log("清理缓存选区失败:", innerError)
            }
        }
    },

    getLiveTextSelection: function() {
        try {
            const selection = this.getActiveSelection()
            const textRange = this.getSelectionTextRange(selection)
            if (textRange) {
                return textRange
            }
        } catch (error) {
            console.log("获取实时文本选区失败:", error)
        }

        return null
    },

    applyToMatchingLiveSelection: function(context, url, linkText, screenTip) {
        try {
            const selection = this.getActiveSelection()
            const textRange = this.getSelectionTextRange(selection)
            const state = this.getTextSelectionState(textRange)

            if (!textRange || !state || !state.hasSelection) {
                return false
            }

            const ownerShape = this.getOwnerShape(selection, textRange)
            const liveShapeId = ownerShape && typeof ownerShape.Id === "number"
                ? ownerShape.Id
                : this.getActiveShapeId(selection, textRange)
            const shapeMatches = !!context.shapeId && !!liveShapeId && String(context.shapeId) === String(liveShapeId)
            const rangeMatches = state.start === context.start && state.length === context.length
            const textMatches = state.text === context.text

            if (!textMatches && !(shapeMatches && rangeMatches)) {
                this.logSelectionDebug("实时选区与缓存选区不一致，跳过实时写入", context, selection, textRange)
                return false
            }

            this.applyToLiveSelection(textRange, url, linkText, screenTip)
            return true
        } catch (error) {
            console.log("实时选区写入失败，尝试缓存选区:", error)
            return false
        }
    },

    applyToLiveSelection: function(textRange, url, linkText, screenTip) {
        if (typeof textRange.Length === "number" && textRange.Length === 0) {
            textRange.Text = linkText
        } else if (linkText && textRange.Text !== linkText) {
            textRange.Text = linkText
        }

        this.replaceTextRangeHyperlink(textRange, url, linkText, screenTip)
        textRange.Select()
        return true
    },

    applyToStoredSelection: function(context, url, linkText, screenTip) {
        const target = this.resolveStoredTextTarget(context)

        if (!target || !target.textRange) {
            this.logSelectionDebug("缓存选区无法定位到可写文本范围", context)
            alert("当前选区无法写入超链接")
            return false
        }

        const textRange = target.textRange
        const start = typeof target.start === "number" ? target.start : 0
        const length = typeof target.length === "number" ? target.length : 0
        if (length === 0) {
            return this.insertIntoStoredTextRange(textRange, start, url, linkText, screenTip)
        }

        const targetRange = textRange.Characters(start, length)

        try {
            if (targetRange.Hyperlinks && targetRange.Hyperlinks.Count > 0) {
                for (let index = targetRange.Hyperlinks.Count; index >= 1; index -= 1) {
                    targetRange.Hyperlinks.Item(index).Delete()
                }
            }
        } catch (error) {
            console.log("清理旧超链接失败:", error)
        }

        if (linkText && targetRange.Text !== linkText) {
            targetRange.Text = linkText
        }

        this.replaceTextRangeHyperlink(targetRange, url, linkText, screenTip)
        targetRange.Select()
        return true
    },

    resolveStoredTextTarget: function(context) {
        const slide = this.findSlideById(context.slideId)
        const shape = this.findShapeById(slide, context.shapeId)
        const directTextRange = this.getShapeTextRange(shape)

        if (directTextRange) {
            const match = this.getTextRangeMatch(directTextRange, context)
            return {
                textRange: directTextRange,
                start: match ? match.start : context.start,
                length: match ? match.length : context.length
            }
        }

        const nestedTarget = this.findMatchingTextTargetInShape(shape, context)
        if (nestedTarget) {
            return nestedTarget
        }

        return null
    },

    getShapeTextRange: function(shape) {
        try {
            if (shape && shape.TextFrame && shape.TextFrame.TextRange) {
                return shape.TextFrame.TextRange
            }
        } catch (error) {
            console.log("读取形状文本范围失败:", error)
        }

        return null
    },

    getTextRangeMatch: function(textRange, context) {
        const start = typeof context.start === "number" ? context.start : 0
        const length = typeof context.length === "number" ? context.length : 0
        const selectedText = typeof context.text === "string" ? context.text : ""

        if (!textRange || !selectedText || length <= 0) {
            return null
        }

        try {
            const candidateRange = textRange.Characters(start, length)
            if (candidateRange && candidateRange.Text === selectedText) {
                return { start: start, length: length }
            }
        } catch (error) {
            console.log("按原始位置匹配文本失败:", error)
        }

        try {
            const fullText = textRange.Text || ""
            const index = fullText.indexOf(selectedText)
            if (index >= 0) {
                return {
                    start: index + 1,
                    length: selectedText.length
                }
            }
        } catch (error) {
            console.log("按文本内容匹配文本失败:", error)
        }

        return null
    },

    findMatchingTextTargetInShape: function(shape, context, depth) {
        if (!shape || (typeof depth === "number" && depth > 8)) {
            return null
        }

        const collections = this.getNestedShapeCollections(shape)
        for (let collectionIndex = 0; collectionIndex < collections.length; collectionIndex += 1) {
            const target = this.findMatchingTextTargetInCollection(collections[collectionIndex], context, (depth || 0) + 1)
            if (target) {
                return target
            }
        }

        return null
    },

    findMatchingTextTargetInCollection: function(shapes, context, depth) {
        try {
            if (!shapes || !shapes.Count || depth > 8) {
                return null
            }

            for (let index = 1; index <= shapes.Count; index += 1) {
                const shape = shapes.Item(index)
                const textRange = this.getShapeTextRange(shape)
                const match = this.getTextRangeMatch(textRange, context)

                if (match) {
                    return {
                        textRange: textRange,
                        start: match.start,
                        length: match.length
                    }
                }

                const nestedTarget = this.findMatchingTextTargetInShape(shape, context, depth + 1)
                if (nestedTarget) {
                    return nestedTarget
                }
            }
        } catch (error) {
            console.log("查找子形状文本失败:", error)
        }

        return null
    },

    insertIntoStoredTextRange: function(textRange, start, url, linkText, screenTip) {
        const originalText = textRange.Text || ""
        const safeStart = Math.max(0, Math.min(start, originalText.length))
        const nextText = `${originalText.slice(0, safeStart)}${linkText}${originalText.slice(safeStart)}`

        textRange.Text = nextText

        const insertedRange = textRange.Characters(safeStart + 1, linkText.length)
        this.replaceTextRangeHyperlink(insertedRange, url, linkText, screenTip)
        insertedRange.Select()
        return true
    },

    insertWithFallbackTextbox: function(context, url, linkText, screenTip) {
        const presentation = window.Application.ActivePresentation
        const slide = this.findSlideById(context.slideId) || (presentation && presentation.Slides && presentation.Slides.Count > 0 ? presentation.Slides.Item(1) : null)

        if (!slide || !slide.Shapes) {
            alert("无法在当前位置插入超链接")
            return false
        }

        const shape = slide.Shapes.AddTextbox(1, 120, 120, 360, 60)
        if (!shape || !shape.TextFrame || !shape.TextFrame.TextRange) {
            alert("无法在当前位置插入超链接")
            return false
        }

        const textRange = shape.TextFrame.TextRange
        textRange.Text = linkText
        this.replaceTextRangeHyperlink(textRange, url, linkText, screenTip)
        textRange.Select()
        return true
    },

    replaceTextRangeHyperlink: function(textRange, url, linkText, screenTip) {
        try {
            if (textRange.Hyperlinks && textRange.Hyperlinks.Count > 0) {
                for (let index = textRange.Hyperlinks.Count; index >= 1; index -= 1) {
                    textRange.Hyperlinks.Item(index).Delete()
                }
            }
        } catch (error) {
            console.log("清理文本超链接失败:", error)
        }

        try {
            const actionSetting = textRange.ActionSettings.Item(this.getMouseClickEnum())
            actionSetting.Action = this.getHyperlinkActionEnum()
            actionSetting.Hyperlink.Address = url
            actionSetting.Hyperlink.SubAddress = ""
            actionSetting.Hyperlink.ScreenTip = screenTip || linkText
            return true
        } catch (error) {
            console.log("通过 ActionSettings 写入超链接失败:", error)
        }

        try {
            if (textRange.Hyperlinks && typeof textRange.Hyperlinks.Add === "function") {
                textRange.Hyperlinks.Add(textRange, url, "", screenTip || linkText, linkText)
                return true
            }
        } catch (error) {
            console.log("通过 Hyperlinks.Add 写入超链接失败:", error)
        }

        throw new Error("当前选区不支持通过 JS 写入超链接")
    },

    getMouseClickEnum: function() {
        return window.Application.Enum ? window.Application.Enum.ppMouseClick : 1
    },

    getHyperlinkActionEnum: function() {
        return window.Application.Enum ? window.Application.Enum.ppActionHyperlink : 7
    },

    findSlideById: function(slideId) {
        try {
            const presentation = window.Application.ActivePresentation
            if (!presentation || !presentation.Slides || !slideId) {
                return null
            }

            for (let index = 1; index <= presentation.Slides.Count; index += 1) {
                const slide = presentation.Slides.Item(index)
                if (slide && slide.SlideID === slideId) {
                    return slide
                }
            }
        } catch (error) {
            console.log("查找幻灯片失败:", error)
        }

        return null
    },

    findShapeById: function(slide, shapeId) {
        try {
            if (!slide || !slide.Shapes || !shapeId) {
                return null
            }

            return this.findShapeInCollection(slide.Shapes, shapeId, 0)
        } catch (error) {
            console.log("查找形状失败:", error)
        }

        return null
    },

    findShapeInCollection: function(shapes, shapeId, depth) {
        try {
            if (!shapes || !shapes.Count || depth > 8) {
                return null
            }

            for (let index = 1; index <= shapes.Count; index += 1) {
                const shape = shapes.Item(index)
                if (shape && String(shape.Id) === String(shapeId)) {
                    return shape
                }

                const collections = this.getNestedShapeCollections(shape)
                for (let collectionIndex = 0; collectionIndex < collections.length; collectionIndex += 1) {
                    const nestedShape = this.findShapeInCollection(collections[collectionIndex], shapeId, depth + 1)
                    if (nestedShape) {
                        return nestedShape
                    }
                }
            }
        } catch (error) {
            console.log("递归查找形状失败:", error)
        }

        return null
    },

    getNestedShapeCollections: function(shape) {
        const collections = []

        try {
            if (shape && shape.GroupItems && shape.GroupItems.Count > 0) {
                collections.push(shape.GroupItems)
            }
        } catch (error) {
            console.log("读取 GroupItems 失败:", error)
        }

        try {
            if (shape && shape.Shapes && shape.Shapes.Count > 0) {
                collections.push(shape.Shapes)
            }
        } catch (error) {
            console.log("读取子 Shapes 失败:", error)
        }

        return collections
    },

    logSelectionDebug: function(label, context, selection, textRange) {
        try {
            const activeSelection = selection || this.getActiveSelection()
            const activeTextRange = textRange || this.getSelectionTextRange(activeSelection)
            const ownerShape = this.getOwnerShape(activeSelection, activeTextRange)

            console.log("[link-bind] " + label, {
                context: context || null,
                selectionType: this.getSelectionType(activeSelection),
                liveText: activeTextRange && typeof activeTextRange.Text === "string" ? activeTextRange.Text : "",
                liveStart: activeTextRange && typeof activeTextRange.Start === "number" ? activeTextRange.Start : 0,
                liveLength: activeTextRange && typeof activeTextRange.Length === "number" ? activeTextRange.Length : 0,
                ownerShapeId: ownerShape && typeof ownerShape.Id === "number" ? ownerShape.Id : 0,
                ownerSlideId: this.getSlideIdFromShape(ownerShape)
            })
        } catch (error) {
            console.log("[link-bind] 输出选区调试信息失败:", error)
        }
    },

    GetImage: function(control) {
        if (control.Id === "btnSetHyperlink") {
            return "images/3.svg"
        }

        return "images/newFromTemp.svg"
    },

    OnGetEnabled: function(control) {
        if (control.Id === "btnSetHyperlink") {
            return true
        }

        return true
    }
}

export default ribbon;
