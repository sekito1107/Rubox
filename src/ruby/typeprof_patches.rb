module TypeProfPatches
  def self.apply!
    # 1. 組み込みメソッドの挙動を直接書き換える (RBSより強力)
    apply_builtin_patches
    # 2. 多重代入の型推論バグの修正
    apply_masgn_patches
  end

  def self.patch_service(core)
    # 3. update_rbs_file の安全性向上
    class << core
      def update_rbs_file(path, code)
        prev_decls = @rbs_text_nodes[path]
        begin
          decls = TypeProf::Core::AST.parse_rbs(path, code || File.read(path))
        rescue
          return false
        end
        decls = decls.compact
        @rbs_text_nodes[path] = decls
        decls.each {|decl| decl.define(@genv) }
        prev_decls.each {|decl| decl.undefine(@genv) } if prev_decls
        @genv.define_all
        decls.each {|decl| decl.install(@genv) }
        prev_decls.each {|decl| decl.uninstall(@genv) } if prev_decls
        @genv.run_all
        true
      end
    end
  end

  private

  def self.apply_builtin_patches
    TypeProf::Core::Builtin.class_eval do
      alias_method :orig_deploy, :deploy
      def deploy
        orig_deploy
        [[:Object], [:Kernel]].each do |cpath|
          begin
            # gets が常に String を返すように強制
            me = @genv.resolve_method(cpath, false, :gets)
            me.builtin = method(:kernel_gets) if me
          rescue
          end
          begin
            # Kernel#Array: Range[Elem] → Array[Elem] の正しい型推論を登録
            me = @genv.resolve_method(cpath, false, :Array)
            me.builtin = method(:kernel_array_conv) if me
          rescue
          end
        end
      end

      def kernel_gets(changes, node, ty, a_args, ret)
        vtx = TypeProf::Core::Source.new(@genv.str_type)
        changes.add_edge(@genv, vtx, ret)
        true
      end

      # Range[Elem] -> Array[Elem]
      def kernel_array_conv(changes, node, ty, a_args, ret)
        return false unless a_args.positionals.size == 1

        arg_vtx = a_args.positionals[0]
        elem_vtx = TypeProf::Core::Vertex.new(node)
        handled = false

        arg_vtx.each_type do |arg_ty|
          handled = true
          case arg_ty
          when TypeProf::Core::Type::Instance
            if arg_ty.mod == @genv.mod_range && arg_ty.args && !arg_ty.args.empty?
              changes.add_edge(@genv, arg_ty.args[0], elem_vtx)
            elsif arg_ty.mod == @genv.mod_ary
              changes.add_edge(@genv, TypeProf::Core::Source.new(arg_ty), ret)
              next
            else
              changes.add_edge(@genv, TypeProf::Core::Source.new(arg_ty), elem_vtx)
            end
          when TypeProf::Core::Type::Array
            changes.add_edge(@genv, TypeProf::Core::Source.new(arg_ty), ret)
            next
          else
            changes.add_edge(@genv, TypeProf::Core::Source.new(arg_ty), elem_vtx)
          end
        end

        return false unless handled

        ary_ty = @genv.gen_ary_type(elem_vtx)
        changes.add_edge(@genv, TypeProf::Core::Source.new(ary_ty), ret)
        true
      end
    end
  end

  def self.apply_masgn_patches
    TypeProf::Core::MAsgnBox.class_eval do
      def run0(genv, changes)
        @value.each_type do |ty|
          case ty
          when TypeProf::Core::Type::Array
            ty.splat_assign(genv, @lefts, @rest_elem, @rights).each do |src, dst|
              changes.add_edge(genv, src, dst)
            end
          when TypeProf::Core::Type::Instance
            if ty.mod == genv.mod_ary && (elem_vtx = ty.args[0])
              @lefts.each {|lhs| changes.add_edge(genv, elem_vtx, lhs) }
              changes.add_edge(genv, TypeProf::Core::Source.new(genv.gen_ary_type(elem_vtx)), @rest_elem) if @rest_elem
              @rights&.each {|rhs| changes.add_edge(genv, elem_vtx, rhs) }
            else
              lhs = @lefts[0] || (@rights && @rights[0]) || @rest_elem
              changes.add_edge(genv, TypeProf::Core::Source.new(ty), lhs) if lhs
            end
          else
            lhs = @lefts[0] || (@rights && @rights[0]) || @rest_elem
            changes.add_edge(genv, TypeProf::Core::Source.new(ty), lhs) if lhs
            # 余る変数には nil を代入
            (@lefts[1..] || []).each {|dst| changes.add_edge(genv, TypeProf::Core::Source.new(TypeProf::Core::Type.nil), dst) } if @lefts[0]
          end
        end
      end
    end
  end
end
