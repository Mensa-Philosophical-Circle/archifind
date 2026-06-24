class Archifind < Formula
  desc "Scan codebases and visualize architecture as an interactive graph"
  homepage "https://github.com/Mensa-Philosophical-Circle/archifind"
  url "https://github.com/Mensa-Philosophical-Circle/archifind/archive/refs/tags/autopush-5-cde28bd.tar.gz"
  version "1.0.1"
  sha256 "e302946aea2f4c783b5f769397d993c0f827a0361bef71395399a7e0cfdabd70"
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
