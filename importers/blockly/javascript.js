// Example of importer for blockly core blocks. Importer API experiment - work in progress, importer will be a class.

// List of blockly blocks, info about this importer implementation and the case in which implements.
/*
  * Logic
    - controls_if               // IMPLEMENTED -> "IfStatement"
    - logic_compare             // IMPLEMENTED -> "BinaryExpression"
    - logic_operation           // IMPLEMENTED -> "LogicalExpression"
    - logic_negate              // IMPLEMENTED -> "UnaryExpression"
    - logic_boolean             // IMPLEMENTED -> "Literal"
    - logic_null                // IMPLEMENTED -> "Literal"
    - logic_ternary             // IMPLEMENTED -> "ConditionalExpression"
  * Loops
    - controls_repeat_ext
    - controls_whileUntil       // IMPLEMENTED -> "WhileStatement"
    - controls_for
    - controls_forEach
    - controls_flow_statements
  * Math
    - math_number               // IMPLEMENTED -> "Literal"
    - math_arithmetic           // IMPLEMENTED -> "BinaryExpression"
    - math_single
    - math_trig
    - math_constant
    - math_number_property
    - math_change
    - math_round
    - math_on_list
    - math_modulo
    - math_constrain
    - math_random_int
    - math_random_float
  * Text
    - text                      // IMPLEMENTED -> "Literal"
    - text_join
    - text_append
    - text_length
    - text_isEmpty
    - text_indexOf
    - text_charAt
    - text_getSubstring
    - text_changeCase
    - text_trim
    - text_print
    - text_prompt_ext
  * Lists
    - lists_create_empty
    - lists_create_with        // IMPLEMENTED -> "ArrayExpression"
    - lists_repeat
    - lists_length
    - lists_isEmpty
    - lists_indexOf
    - lists_getIndex
    - lists_setIndex
    - lists_getSublist
    - lists_split
  * Colour
    - colour_picker
    - colour_random
    - colour_rgb
    - colour_blend
  * Variables
  * Functions
*/


// first import js block generators into blockly js generator context
for (var el in Blocklify.JavaScript.Generator) {
  if (el.substring(0,3) == 'js_') {
    Blockly.JavaScript[el] = Blocklify.JavaScript.Generator[el];
  }
}

// now the block importer
Blockly.JavaScript.importer = function(node, parent, options) {
  // this is the importer for blockly block (pattern converter)
  //the returned block
  var block = null, field;
  //none-estetic inline blocks
  var no_inline_blocks = [];
  switch (node.type) {
    case "Program":
      block = goog.dom.createDom('xml');
      Blocklify.JavaScript.importer.appendStatement(block, node.body, node, options);
      break;
    case "BlockStatement":
      block = Blocklify.JavaScript.importer.appendStatement(null, node.body, node, options);
      break;
    case "Literal":    // logic_null, math_number, text, logic_boolean
      block = goog.dom.createDom('block');
      if (node.value == null) {
        block.setAttribute('type' ,'logic_null');
      } else {
        var nodeType = typeof(node.value);
        if (nodeType == "number") {
          block.setAttribute('type' ,'math_number');
          Blocklify.JavaScript.importer.appendField(block, 'NUM', node.value + '');
        } else if(nodeType == "string") {
          block.setAttribute('type' ,'text');
          Blocklify.JavaScript.importer.appendField(block, 'TEXT', node.value);
        } else if(nodeType == "boolean") {
          block.setAttribute('type' ,'logic_boolean');
          Blocklify.JavaScript.importer.appendField(block, 'BOOL', node.raw);
        }
      }
      break;
    case "IfStatement":    // controls_if
      block = Blocklify.JavaScript.importer.createBlock('controls_if');
      var tests = [], consequents = [], current_node = node.alternate, countElseIf = 0, countElse = 0;
      tests.push(Blocklify.JavaScript.importer.convert_atomic(node.test, node, options));
      Blocklify.JavaScript.importer.setOutput(tests[0], true);
      consequents.push(Blocklify.JavaScript.importer.convert_atomic(node.consequent, node, options));
      Blocklify.JavaScript.importer.setOutput(tests[0], true);
      while (current_node) {
        if (current_node.type == 'IfStatement') {
          countElseIf++;
          tests.push(Blocklify.JavaScript.importer.convert_atomic(current_node.test, current_node, options));
          Blocklify.JavaScript.importer.setOutput(tests[tests.length-1], true);
          consequents.push(Blocklify.JavaScript.importer.convert_atomic(current_node.consequent, current_node, options));
          current_node = current_node.alternate;
        } else {
          countElse = 1;
          var alternate = Blocklify.JavaScript.importer.convert_atomic(current_node.alternate || current_node, node, options);
          current_node = null;
        }
      };
      var mutation = goog.dom.createDom('mutation');
      block.appendChild(mutation);
      mutation.setAttribute('elseif', countElseIf + '');
      mutation.setAttribute('else', countElse + '');
      Blocklify.JavaScript.importer.appendValueInput(block, 'IF0', tests[0]);
      Blocklify.JavaScript.importer.appendValueInput(block, 'DO0', consequents[0]);
      for (var i = 1; i <= countElseIf; i++) {
        Blocklify.JavaScript.importer.appendValueInput(block, 'IF' + i, tests[i]);
        Blocklify.JavaScript.importer.appendValueInput(block, 'DO' + i, consequents[i]);
      }
      if (countElse == 1) {
        Blocklify.JavaScript.importer.appendValueInput(block, 'ELSE', alternate);
      }
      break;
    case "ArrayExpression":
      block = Blocklify.JavaScript.importer.createBlock('lists_create_with');
      Blocklify.JavaScript.importer.appendCloneMutation(block, 'items', 'ADD', node.elements, node, options);
      break;
    case "WhileStatement":    // controls_whileUntil
      block = Blocklify.JavaScript.importer.createBlock('controls_whileUntil');
      if (node.test.type == 'UnaryExpression' && node.test.operator == '!') {
        mode = 'UNTIL';
        procesedTest = node.test.argument;
      } else {
        mode = 'WHILE';
        procesedTest = node.test;
      }
      Blocklify.JavaScript.importer.appendField(block, 'MODE', mode);
      var test = Blocklify.JavaScript.importer.convert_atomic(procesedTest, node, options);
      var body = Blocklify.JavaScript.importer.convert_atomic(node.body, node, options);
      Blocklify.JavaScript.importer.appendValueInput(block, 'BOOL', test);
      Blocklify.JavaScript.importer.appendValueInput(block, 'DO', body);
      break;
    case "BinaryExpression": case "LogicalExpression":
      // math_arithmetic, logic_compare, logic_operation
      if (['+', '-', '*', '/', '==', '!=',
             '<', '>', '<=', '>=', '&&', '||'].indexOf(node.operator) != -1) { // Blockly-JavaScript acepted operators

        var A = Blocklify.JavaScript.importer.convert_atomic(node.left, node, options);
        var B = Blocklify.JavaScript.importer.convert_atomic(node.right, node, options);

        if (['+', '-', '*', '/'].indexOf(node.operator) != -1) { // math_arithmetic
          var operators = {'+': 'ADD', '-': 'MINUS', '*': 'MULTIPLY', '/': 'DIVIDE'};
          block = Blocklify.JavaScript.importer.createBlock('math_arithmetic');
        } else if (['==', '!=', '<', '>', '<=', '>='].indexOf(node.operator) != -1) { // logic_compare
          var operators = {'==': 'EQ', '!=': 'NEQ',
                           '<': 'LT', '>': 'GT',
                           '<=': 'LTE', '>=': 'GTE'};
          block = Blocklify.JavaScript.importer.createBlock('logic_compare');
        } else if (['&&', '||'].indexOf(node.operator) != -1) { // logic_operation
          var operators = {'&&': 'AND', '||': 'OR'};
          block = Blocklify.JavaScript.importer.createBlock('logic_operation');
        }
        Blocklify.JavaScript.importer.appendField(block, 'OP', operators[node.operator]);
        Blocklify.JavaScript.importer.appendValueInput(block, 'A', A);
        Blocklify.JavaScript.importer.appendValueInput(block, 'B', B);
        break;
      }
    case "UnaryExpression":    // logic_negate
      if (node.operator == '!') {
        block = Blocklify.JavaScript.importer.createBlock('logic_negate');
        var argument = Blocklify.JavaScript.importer.convert_atomic(node.argument, node, options);
        Blocklify.JavaScript.importer.appendValueInput(block, 'BOOL', argument);
        break;
      }
    case "ConditionalExpression":    // logic_ternary
      block = Blocklify.JavaScript.importer.createBlock('logic_ternary');
      var test = Blocklify.JavaScript.importer.convert_atomic(node.test, node, options);
      var consequent = Blocklify.JavaScript.importer.convert_atomic(node.consequent, node, options);
      var alternate = Blocklify.JavaScript.importer.convert_atomic(node.alternate, node, options);
      Blocklify.JavaScript.importer.appendValueInput(block, 'IF', test);
      Blocklify.JavaScript.importer.appendValueInput(block, 'THEN', consequent);
      Blocklify.JavaScript.importer.appendValueInput(block, 'ELSE', alternate);
      break;
      
    default:  // if not implemented block
      break;
  }
  return block;
};

// register the importer
Blocklify.JavaScript.importer.importers.push(Blockly.JavaScript.importer);
