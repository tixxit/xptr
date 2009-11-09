/* Copyright (c) 2009, International Joint Commission
 * 
 * This file is licensed under the ISCL. A copy of the license should be 
 * distributed with the software; if not, you can obtain a copy here: 
 * http://www.opensource.org/licenses/isc-license.txt
 */
/** @fileoverview
 * The XPath AST interpreter.
 *
 * @author Tom Switzer (switzert@windsor.ijc.org)
 */
(function() {

var xpath = window.xpath || {};
var interpreter = xpath.interpreter = {};

var extend = xpath.util.extend;
var Class = xpath.util.Class;

var XPathExpression = Class({
    evaluate: function(context) {
    }
});

var Compiler = Class({
    compile: function(ast) {
        var compVisitor = new CompilerVisitor();
        ast.accept(compVisitor);
        return null;
    }
});


var CompilerVisitor = Class(xpath.ast.ASTVisitor, {
    init: function() {
        this.steps = [];
    },
    visitXPathExprNode: function() {
        
    },
    visitPathNode: nop,
    visitStepNode: nop,
    visitPredicateListNode: nop,
    visitPredicateNode: nop,
    visitNodeTestNode: nop,
    visitArgumentListNode: nop,
    visitNumberNode: nop,
    visitLiteralNode: nop,
    visitVariableRefNode: nop,
    visitFunctionCallNode: nop,
    visitPathExprNode: nop,
    visitFilterExprNode: nop,
    visitUnionExprNode: nop,
    visitOrExprNode: nop,
    visitAndExprNode: nop,
    visitEqExprNode: nop,
    visitNeqExprNode: nop,
    visitLtExprNode: nop,
    visitGtExprNode: nop,
    visitLteExprNode: nop,
    visitGteExprNode: nop,
    visitAddExprNode: nop,
    visitSubExprNode: nop,
    visitMulExprNode: nop,
    visitDivExprNode: nop,
    visitModExprNode: nop,
    visitNegExprNode: nop
});


// getElementsByTagName could substantially speed up a search in cases where the
// axes involves a large number of nodes, but getElementsByTagName returns a 
// small set. Either way we have to iterate through all of either set, so, if
// the NodeList returned by getElementsByTagName is smaller then the number of 
// nodes searched in the guided traversal, then we should use 
// getElementsByTagName... Of course, we also run the problem where if we have
// a position given (eg. div[2]), then it would be faster to use the the guide.
// I think this kind of optimization should be abstracted. Perhaps create a 
// GuideManager that returns a "good" guide to use, given some parameters (eg.
// predicate list, name test, axis, etc.)


/**
 * Axis guides are methods that take 2 arguments; a node and a callback. A
 * guide for an axis will traverse, in order, all the nodes in that axis, each
 * time calling the callback provided with the current node as the argument.
 *
 * Generally, we traverse the DOM in document order (pre-order). The 
 * exceptions to this are {@code preceding}, {@code precedingSibling}, 
 * {@code ancestor}, {@code ancestor-or-self}, {@code attribute} and 
 * {@code namespace}. {@code preceding}, {@code precedingSibling}, 
 * {@code ancestor} and {@code ancestor-or-self} traverse the DOM in reverse 
 * document order. For {@code ancestor} and {@code ancestor-or-self} this means
 * we climb up the DOM. The order for {@code attribute} and {@code namespace} is
 * not guaranteed and the order should be considered arbitrary. 
 * 
 * If at anytime during the traversal the callback function returns false, and 
 * only false (other values that evaluate to false, like null or '', won't 
 * affect the traversal), the guide will stop the traversal at that node and 
 * return false. Otherwise, if the traversal completes normally, the guide 
 * returns true.
 *
 * @note When there are axes who have dashes (-) in the name, there is also a
 * corresponding guide with the dashes removed and camel-cased so it can be used
 * as an object method (ie. with a .). For example, there is a guide 
 * {@code guide['descendant-or-self'] and, also, {@code guide.descendantOrSelf}.
 *
 * @note The Guide is meant to be subclassed (or an instance extended) to 
 * support new axes, should an implementation require it.
 */
xpath.interpreter.AxisGuide = Class({
    self: function(n, cb) {
        return cb(n) !== false;
    },
    parent: function(n, cb) {
        if (n.parentNode)
            return true;
        return cb(n.parentNode) !== false;
    },
    child: function(n, cb) {
        var kids = n.childNodes;
        for (var i = 0, len = kids.length; i < len; i++)
            if (cb(kids[i]) === false)
                return false;
        return true;
    },
    followingSibling: function(n, cb) {
        while (n = n.nextSibling)
            if (cb(n) === false)
                return false;
        return true;
    },
    precedingSibling: function(n, cb) {
        while (n = n.previousSibling)
            if (cb(n) === false)
                return false;
        return true;
    },
    ancestor: function(n, cb) {
        for (n = n.parentNode; n; n = n.parentNode)
            if (cb(n) === false)
                return false;
        return true;
    },
    descendant: function(n, cb) {
        var nodeStack = Array.prototype.slice.call(n.childNodes).reverse();
        for (n = nodeStack.pop(); n !== undefined; n = nodeStack.pop()) {
            if (cb(n) === false)
                return false;
            for (var kids = n.childNodes, i = kids.length - 1; i >= 0; i--)
                nodeStack.push(kids[i]);
        }
        return true;
    },
    following: function(n, cb) {
        for (; n; n = n.parentNode) {
            if (guide.followingSibling(n, function(sib) {
                        return guide.descendant-or-self(sib);
                    }) === false)
                return false;
        }
        return true;
    },
    preceding: function(n, cb) {
        for (; n; n = n.parentNode) {
            if (guide.precedingSibling(n, function(sib) {
                        return guide.reverseOrderDescendant(sib, cb);
                    }) === false)
                return false;
        }
        return true;
    },
    ancestorOrSelf: function(n, cb) {
        return cb(n) !== false && guide.ancestor(n, cb) !== false;
    },
    descendantOrSelf: function(n, cb) {
        return cb(n) !== false && guide.descendant(n, cb) !== false;
    },
    attribute: function(n, cb) {
        // Only ELEMENT node types have attributes
        if (n.nodeType == 1) {
            var attrs = n.attributes;   // attrs is a NamedNodeMap
            for (var i = 0, len = attrs.length; i < len; i++)
                if (cb(attrs[i]) === false)
                    return false;
        }
        return true;
    },
    namespace: function(n, cb) {
        /// @todo Write namespace guide
        return false;
    },
    reverseOrderDescendant: function(n, cb) {
        /// @todo Re-write this function to be iterative, not recursive...
        
        if (n.hasChildNodes())
            for (var k = n.lastChild; k; k = k.previousSibling)
                if (guide.reverseDescendant(k) === false)
                    return false;
        return cb(n) !== false;
    },
    'following-sibling': guide.followingSibling,
    'preceding-sibling': guide.precedingSibling,
    'ancestor-or-self': guide.ancestorOrSelf,
    'descendant-or-self': guide.descendantOrSelf
});

})();
