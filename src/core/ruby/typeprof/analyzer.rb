require "prism"
require "typeprof"

module Analyzer
  class Visitor < Prism::Visitor
    def initialize(service)
      @service = service
      @methods = []
      @variables = []
      @literals = []
    end

    def results
      { methods: @methods, variables: @variables, literals: @literals }
    end

    def visit_call_node(node)
      add_method(node.name, node)
      super
    end
    
    def visit_def_node(node)
      add_method(node.name, node)
      super
    end

    def visit_local_variable_write_node(node)
      add_variable(node.name, node)
      super
    end

    def visit_local_variable_read_node(node)
      add_variable(node.name, node)
      super
    end

    def visit_local_variable_target_node(node)
      add_variable(node.name, node)
      super
    end

    def visit_instance_variable_target_node(node)
      add_variable(node.name, node)
      super
    end

    def visit_global_variable_target_node(node)
      add_variable(node.name, node)
      super
    end

    def visit_multi_write_node(node)
      node.lefts.each { |l| l.accept(self) }
      node.rest&.accept(self)
      node.rights.each { |r| r.accept(self) }
      node.value.accept(self)
    end

    def visit_block_local_variable_node(node)
      add_variable(node.name, node)
      super
    end

    def visit_required_parameter_node(node)
      add_variable(node.name, node)
      super
    end

    def visit_optional_parameter_node(node)
      add_variable(node.name, node)
      super
    end

    def visit_integer_node(node)
      add_literal(node)
      super
    end

    def visit_float_node(node)
      add_literal(node)
      super
    end

    def visit_string_node(node)
      add_literal(node)
      super
    end

    def visit_symbol_node(node)
      add_literal(node)
      super
    end

    def visit_true_node(node)
      add_literal(node)
      super
    end

    def visit_false_node(node)
      add_literal(node)
      super
    end

    def visit_nil_node(node)
      add_literal(node)
      super
    end

    def visit_array_node(node)
      add_literal(node)
      super
    end

    def visit_hash_node(node)
      add_literal(node)
      super
    end

    def visit_block_argument_node(node)
      expression = node.expression
      if expression.is_a?(Prism::SymbolNode)
        add_method(expression.unescaped, expression)
      end
      super
    end

    private

    def add_method(name, node)
      query_loc = (node.message_loc if node.respond_to?(:message_loc)) || node.location
      info = resolve_info(query_loc)

      @methods << {
        name: name.to_s,
        line: query_loc.start_line,
        col: query_loc.start_column,
        info: info
      }
    end

    def add_variable(name, node)
      loc = node.location
      info = resolve_info(loc) || { type_info: nil }

      @variables << {
        name: name.to_s,
        line: loc.start_line,
        col: loc.start_column,
        type_info: info[:type_info]
      }
    end

    def add_literal(node)
      loc = node.location
      info = resolve_info(loc) || { type_info: nil }

      @literals << {
        name: node.slice,
        line: loc.start_line,
        col: loc.start_column,
        type_info: info[:type_info]
      }
    end

    def resolve_info(loc)
      return nil unless (service = @service)
      pos = TypeProf::CodePosition.new(loc.start_line, loc.start_column)
      root = service.instance_variable_get(:@rb_text_nodes)["main.rb"]
      
      info = nil
      root&.retrieve_at(pos) do |n|
        if method_call_node?(n)
          info = resolve_method_call(n, service)
          break if info
        end

        if n.respond_to?(:ret) && n.ret
          info ||= {}
          info[:type_info] = (n.ret.show rescue n.ret.to_s)
        end

        break if info
      end
      
      info || {
        owner: nil,
        owner_type: nil,
        has_singleton: false,
        type_info: nil
      }
    end

    def method_call_node?(node)
      return false unless node.respond_to?(:boxes)
      node.boxes(:mcall) { return true }
      false
    end

    def resolve_method_call(node, service)
      info = nil
      node.boxes(:mcall) do |box|
        box.resolve(service.genv, nil) do |me, _ty, mid, orig_ty|
          next unless me

          info = extract_method_metadata(me, service)
          info[:owner] ||= orig_ty&.base_type(service.genv)&.show
          info[:type_info] = _ty.show if _ty.respond_to?(:show)
        end
      end
      info
    end

    private

    def extract_method_metadata(me, service)
      source = me.decls.to_a.first || me.defs.to_a.first
      mod = service.genv.resolve_cpath(source.cpath)

      # RBS の属性を取得 (SigDefNode#attrs)
      node = source.instance_variable_get(:@node)
      attrs = node&.respond_to?(:attrs) ? node.attrs : {}

      {
        owner: source.cpath.join("::"),
        owner_type: (mod&.module? ? "module" : "class"),
        is_singleton_call: !!source.singleton,
        has_instance: !!attrs[:instance],
        has_singleton: !!attrs[:singleton]
      }
    end
  end

  class << self
    def run(code)
      begin
        TypeProfEngine.update(code)
        service = TypeProfEngine.service

        result = Prism.parse(code)
        # エラーがあっても、resultには解析出来た部分の情報が格納されているので、それを返す
        return { methods: [], variables: [], literals: [] }.to_json unless result.value

        visitor = Visitor.new(service)
        result.value.accept(visitor)
        visitor.results.to_json
      rescue => e
        { methods: [], variables: [], literals: [] }.to_json
      end
    end
  end
end
