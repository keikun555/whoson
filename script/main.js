var Renderer = function(canvas) {
  var canvas = $(canvas).get(0)
  var ctx = canvas.getContext("2d")
  var particleSystem

  var that = {
    init: function(system) {
      //
      // the particle system will call the init function once, right before the
      // first frame is to be drawn. it's a good place to set up the canvas and
      // to pass the canvas size to the particle system
      //
      // save a reference to the particle system for use in the .redraw() loop
      particleSystem = system

      // inform the system of the screen dimensions so it can map coords for us.
      // if the canvas is ever resized, screenSize should be called again with
      // the new dimensions
      particleSystem.screenSize(canvas.width, canvas.height)
      particleSystem.screenPadding(50) // leave an extra 80px of whitespace per side
      $(window).resize(that.resize)
      that.resize()

      // set up some event handlers to allow for node-dragging
      that.initMouseHandling()
    },

    redraw: function() {
      //
      // redraw will be called repeatedly during the run whenever the node positions
      // change. the new positions for the nodes can be accessed by looking at the
      // .p attribute of a given node. however the p.x & p.y values are in the coordinates
      // of the particle system rather than the screen. you can either map them to
      // the screen yourself, or use the convenience iterators .eachNode (and .eachEdge)
      // which allow you to step through the actual node objects but also pass an
      // x,y point in the screen's coordinate system
      //
      ctx.fillStyle = "white"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      particleSystem.eachEdge(function(edge, pt1, pt2) {
        // edge: {source:Node, target:Node, length:#, data:{}}
        // pt1:  {x:#, y:#}  source position in screen coords
        // pt2:  {x:#, y:#}  target position in screen coords

        // draw a line from pt1 to pt2
        ctx.strokeStyle = "rgba(0,0,0, .333)"
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(pt1.x, pt1.y)
        ctx.lineTo(pt2.x, pt2.y)
        ctx.stroke()
      })

      particleSystem.eachNode(function(node, pt) {
        // node: {mass:#, p:{x,y}, name:"", data:{}}
        // pt:   {x:#, y:#}  node position in screen coords

        // draw a rectangle centered at pt
        var text = node.name
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.font = `${node.data.fontsize}pt Arial`
        var padding = node.data.fontsize
        var h = parseInt(ctx.font) + padding
        var w = ctx.measureText(text).width + padding

        ctx.fillStyle = node.data.fillcolor
        ctx.fillRect(pt.x - w / 2, pt.y - h / 2, w, h)

        ctx.fillStyle = node.data.fontcolor
        ctx.fillText(text, pt.x, pt.y)
      })
    },

    resize: function() {
      var w = $(window).width(),
        h = $(window).height()
      canvas.width = w
      canvas.height = h // resize the canvas element to fill the screen
      particleSystem.screenSize(w, h) // inform the system so it can map coords for us
      that.redraw()
    },

    initMouseHandling: function() {
      // no-nonsense drag and drop (thanks springy.js)
      var dragged = null

      // set up a handler object that will initially listen for mousedowns then
      // for moves and mouseups while dragging
      var handler = {
        clicked: function(e) {
          var pos = $(canvas).offset()
          _mouseP = arbor.Point(e.pageX - pos.left, e.pageY - pos.top)
          dragged = particleSystem.nearest(_mouseP)

          if (dragged && dragged.node !== null) {
            // while we're dragging, don't let physics move the node
            dragged.node.fixed = true
          }

          $(canvas).bind('mousemove', handler.dragged)
          $(window).bind('mouseup', handler.dropped)

          return false
        },
        dragged: function(e) {
          var pos = $(canvas).offset()
          var s = arbor.Point(e.pageX - pos.left, e.pageY - pos.top)

          if (dragged && dragged.node !== null) {
            var p = particleSystem.fromScreen(s)
            dragged.node.p = p
          }

          return false
        },

        dropped: function(e) {
          if (dragged === null || dragged.node === undefined) return
          if (dragged.node !== null) dragged.node.fixed = false
          dragged.node.tempMass = 1000
          dragged = null
          $(canvas).unbind('mousemove', handler.dragged)
          $(window).unbind('mouseup', handler.dropped)
          _mouseP = null
          return false
        }
      }

      // start listening
      $(canvas).mousedown(handler.clicked)

    },

  }
  return that
}

$(document).ready(function() {
  sys = arborInit()
  $.when(loadData().done(function(data) {
    drawGraph(sys, {"Swarthmore CS Dept": data})
    //drawGraph(sys, data)
  }))
  resize()
  drawGraph(sys)
  $(window).on("resize", function() {
    resize()
  })
})
// function resize() {
//   $("#canvas").outerHeight($(window).height() - $("#canvas").offset().top - Math.abs($("#canvas").outerHeight(true) - $("#canvas").outerHeight()))
// }

function loadData() {
  return $.ajax({
    dataType: "json",
    url: "./data/whoson.json",
  });
}

function drawGraph(sys, data) {
  var roots = Object.keys(data)
  for (root in roots) {
    drawSubtree(sys, roots[root], data[roots[root]], 3)
  }
}

/*
This will draw a subtree with parent as the root
*/
function drawSubtree(sys, parent, data, depth) {
  if (depth <= 0) {
    return null
  }
  if (parent[parent.length - 1] == "*") {
    if(data["ERROR"].split(' ')[0] == "AUTHENTICATION"){
      return null
    } else if (data["ERROR"].split(' ')[0] == "DOWN") {
      sys.addNode(parent, {
        fillcolor: "white",
        fontcolor: "red",
        fontsize: Math.sqrt(depth * 2000),
        mass:1.3
      })
      return parent
    }
  }
  var subtreeKeys = Object.keys(data)
  var children;
  sys.addNode(parent, {
    fillcolor: "white",
    fontcolor: "black",
    fontsize: Math.sqrt(depth * 2000),
    mass:1.3
  })
  for (key in subtreeKeys) {
    child = drawSubtree(sys, subtreeKeys[key], data[subtreeKeys[key]], depth - 1)
    if (child == null) {
      return parent
    } else {
      sys.addEdge(parent, child, {length:.1*depth})
    }
  }
  return parent


  // var nodes = Object.keys(data)
  // var subtrees
  // for (node in nodes){
  //   sys.addNode(nodes[node], {fillcolor:"black", fontcolor: "white", fontsize:depth*25})
  //   subtrees = Object.keys(data[nodes[node]])
  //   for (subtree in subtrees){
  //     childnode = drawSubtree(sys, data[nodes[node]][subtrees[subtree]], depth-1)
  //     if(!(childnode == undefined || childnode == null)){
  //       console.log(childnode + " and " + nodes[node]);
  //       sys.addEdge(childnode, nodes[node])
  //     }
  //   }
  // }
  //
  // sys.addEdge('a', 'b')
  // sys.addEdge('a', 'c')
  // sys.addEdge('a', 'd')
  // sys.addEdge('a', 'e')
  // sys.addNode('f', {
  //   alone: true,
  //   mass: .25
  // })
}

function arborInit() {
  var sys = arbor.ParticleSystem({
    friction: .1,
    stiffness: 600,
    repulsion: 2600,
    gravity: true
  })
  sys.renderer = Renderer("#viewport")
  return sys
}

function resize() {
  console.log()
  $("canvas").width(window.innerWidth)
  $("canvas").height(window.innerHeight)
}
