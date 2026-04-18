class Archifind < Formula
  desc "Scan codebases and visualize architecture as an interactive graph"
  homepage "https://github.com/Mensa-Philosophical-Circle/archifind"
  url "https://github.com/Mensa-Philosophical-Circle/archifind/archive/refs/tags/autopush-1-b9f1d9d.tar.gz"
  version "1.0.1"
  sha256 "abba30ccbbb21f4f4e50b5f0052b8572222ba2fdb0974718f44a2ffa41e00c31"
  license "ISC"

  depends_on "node"

  def install
    libexec.install Dir["*"]

    cd libexec do
      system "npm", "ci", "--no-audit", "--no-fund"
      system "npm", "--prefix", "ui", "ci", "--no-audit", "--no-fund"
      system "npm", "--prefix", "ui", "run", "build"
    end

    (bin / "archifind").write <<~EOS
      #!/bin/sh
      exec "#{Formula["node"].opt_bin}/node" "#{libexec}/src/cli.js" "$@"
    EOS
  end

  test do
    assert_match "archifind", shell_output("#{bin}/archifind --help")
  end
end
