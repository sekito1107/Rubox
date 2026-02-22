y = 3
lines = {}
y.times do |i|
  i
  lines["#{i}"] = gets.chomp.split.map(&:to_i).sum
end
