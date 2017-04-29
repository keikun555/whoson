$(document).ready(function() {
  sys = arborInit()
  $.when(loadData().done(function(d) {
    var depth = 4
    var types = ['root', 'host', 'computer', 'user']
    var data = {
      "Swarthmore CS Dept": d
    }
    var content = parseToContent(null, data, types, depth)
    setupSearch(sys, content, depth)
    drawGraph(sys, data, depth-1)
  }))
})

function setupSearch(sys, content, reccurence) {
  $('.ui.search')
    .search({
      source: content,
      onSelect: function(result, response) {
        if(result.type == "root"){
          var depth = determineDepth(result)
          drawSubtree(sys, result.title, result.children, (window.innerWidth / 100) * Math.pow((4 / 5), depth), reccurence)
        }else if (result.type == "host") {
          var depth = determineDepth(result)
          drawSubtree(sys, result.title, result.children, (window.innerWidth / 100) * Math.pow((4 / 5), depth), reccurence-1)
        } else if (result.type == "computer") {
          var depth = determineDepth(result)
          drawSubtree(sys, result.title, result.children, (window.innerWidth / 100) * Math.pow((4 / 5), depth), reccurence-2)
        } else if (result.type == "user") {
          var depth = determineDepth(result)
          var i = 0;
          while (sys.getNode(result.title + i)) {
            i++
          }
          sys.addNode(result.title + i, {
            name: result.title,
            fillcolor: "black",
            fontcolor: "white",
            childdata: result.children,
            fontsize: (window.innerWidth / 100) * Math.pow((4 / 5), depth),
            mass: 1.3
          })
          sys.addEdge(result.parent, result.title + i, {
            length: .5,
            color: "black",
            thickness: 5
          })
          highlightPathToRoot(sys, result.title + i)
        }
        return true
      }
    })
}

function arborInit() {
  var sys = arbor.ParticleSystem({
    friction: .5,
    stiffness: 512,
    repulsion: 2600,
    gravity: true,
    dt: .35,
    precision: 1
  })
  sys.renderer = Renderer("#viewport")
  return sys
}

function loadData() {
  return $.ajax({
    dataType: "json",
    url: "./data/whoson.json",
  });
}

function parseToContent(parent, data, types, depth) {
  var parsed = []
  if (depth <= 0) {
    return parsed
  }
  var keys = Object.keys(data)
  var newtypes = types.slice(1, types.length)
  for (key in keys) {
    parsed.push({
      title: keys[key],
      type: types[0],
      children: data[keys[key]],
      parent: parent
    })
    parsed = parsed.concat(parseToContent(keys[key], data[keys[key]], newtypes, depth - 1))
  }
  return parsed
}

function drawGraph(sys, data, depth) {
  var roots = Object.keys(data)
  for (root in roots) {
    drawSubtree(sys, roots[root], data[roots[root]], window.innerWidth / 100, depth)
  }
}

/*
This will draw a subtree with parent as the root
*/
function drawSubtree(sys, parent, data, size, depth) {
  if (depth <= 0) {
    return null
  }
  if (parent[parent.length - 1] == "*") {
    if (data["ERROR"].split(' ')[0] == "AUTHENTICATION") {
      return null
    } else if (data["ERROR"].split(' ')[0] == "DOWN") {
      sys.addNode(parent, {
        name: parent,
        fontcolor: "red",
        childdata: data,
        fontsize: size,
        mass: 1.3
      })
      return parent
    }
  }
  var subtreeKeys = Object.keys(data)
  var children;
  sys.addNode(parent, {
    name: parent,
    fontcolor: "black",
    fillcolor: "white",
    childdata: data,
    fontsize: size,
    mass: 1.3
  })
  for (key in subtreeKeys) {
    child = drawSubtree(sys, subtreeKeys[key], data[subtreeKeys[key]], size * 4 / 5, depth - 1)
    if (child == null) {
      return parent
    } else {
      sys.addEdge(parent, child, {
        length: 1 * depth,
        color: "grey",
        thickness: 1
      })
    }
  }
  return parent
}

function highlightPathToRoot(sys, node) {
  var pathToRoot = getEdgesToRoot(sys, node)
  var depth = pathToRoot.length
  var sysNode = sys.getNode(node)
  sysNode.data.fillcolor = "black"
  sysNode.data.fontcolor = "white"
  sys.renderer.redraw()
  sys.tweenNode(sysNode, 2, {
    fillcolor: "white",
    fontcolor: "black",
  })
  var edge = null
  console.log(pathToRoot);
  for (edge in pathToRoot) {
    sys.pruneEdge(pathToRoot[edge])
    edge = sys.addEdge(pathToRoot[edge].source, pathToRoot[edge].target, {
      length: pathToRoot[edge].data.length,
      color: "black",
      thickness: 5
    })
    edge.source.data.fillcolor = "black"
    edge.source.data.fontcolor = "white"
    sys.renderer.redraw()
    sys.tweenNode(edge.source, 2, {
      fillcolor: "white",
      fontcolor: "black",
    })
    sys.tweenEdge(edge, 2, {
      color: "grey",
      thickness: 1
    })
  }
}

function determineDepth(node){
  if(node == null){
    return -1
  }
  if(typeof node === 'string' || node instanceof String){
    return getEdgesToRoot(sys, node).length
  }
  if(node.parent == null){
    return 0
  } else if (sys.getEdgesTo(node.title).length == 0) {
    // console.log(node);
    // var edge = sys.addEdge(node.parent, node.title, {
    //   length: .5,
    //   color: "purple",
    //   thickness: 1
    // })
    // console.log(edge);
    // // var depth = getEdgesToRoot(sys, node.title).length
    // // sys.pruneEdge(edge)
    // // return depth
    // alert()
    return 1 + determineDepth(node.parent)
  } else {
    return getEdgesToRoot(sys, node.title).length
  }
}

function getEdgesToRoot(sys, node) {
  var edgesTo = sys.getEdgesTo(node)
  if (edgesTo.length == 0) {
    return []
  }
  return getEdgesToRoot(sys, edgesTo[0].source).concat(edgesTo[0])
}
