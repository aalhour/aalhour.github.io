---
layout: post
title: "nand2tetris, or Building a Computer from First Principles"
date: 2016-04-01 12:00:00
categories: programming, github, nand2tetris, hardware, emulation, computer design, computer architecture, assembly, assemblers, machine code
blog: active
noteinfo: programming, github, nand2tetris, hardware, emulation, computer design, computer architecture, assembly, assemblers, machine code
---

Last month I finished one of the most interesting and enjoyable Computer Courses on Coursera, the [nand2tetris: Part I](https://www.coursera.org/learn/build-a-computer) Course which goes by the title *"Build a Modern Computer from First Principles: Nand to Tetris"*.

The Coursera MOOC is based on the first part of the book *["Elements of Computing Systems"](https://mitpress.mit.edu/books/elements-computing-systems)*, and its accompanying online self-paced course at [http://www.nand2tetris.org/](http://www.nand2tetris.org/).

Generally, the book and the MOOC, are divided into two parts, in the first part you build the Hardware of the Hack Computer and in the second part you build the Software for it.

In a nutshell, what you basically do in the first part is start with a language that looks like a minified version of VHDL or Verilog called **HDL** (Hardware Description Language) and a Nand gate implementation. From there, you implement all elementary 1-bit logic gates:

  * And.
  * Or.
  * Not.
  * Xor.
  * Mux: multiplexer.
  * DMux: demultiplexer.
  * DMux4Way: 4-ways 1-bit DMux.
  * DMux8Way: 8-ways 1-bit DMux.

And some other 16-bits logic gates:

  * And16: 16-bits AND gate.
  * Or16: 16-bits OR gate.
  * Mux16: 16-bits MUX gate.
  * Mux4Way16: 4-ways 16-bit Mux.
  * Mux8Way16: 8-ways 16-bit Mux.

After that stage, every Weekly Video Module (and book chapter) addresses one component of the Hack Computer in a way that allows to you use previously built abstractions as black boxes, for example: After building And, Or and all the other elementary gates, you start using them as black boxes to build larger ones such as the binary Half-Adders and Full-Adders, which you then use as black boxes to build the ALU (Arithmetic Logic Unit) hardware component. You keep going forward in designing the hardware components from most basic to most sophisticated until you reach the end of this first part in which you assemble all the hardware components into a working 16-bits Computer.

Part 1 doesn't just finish with a working Computer, you will have to build the Assembler, which is the only software component you need to build in Part 1. The Assembler would read a program's source code written in the Hack Assembly Language and then assemble it into executable 16-bits binary machine code instructions that can be run on the Hack Computer.

The general progression path through the course from the perspective of building hardware components is as follows:

  1. Build Elementary Logic Gates (see: above).

  2. Build the ALU Component:

     2.1. Build the 16-bits XOR gate: Xor16.

     2.2. Use Xor16 gate to build the Half Binary Adder circuit: HalfAddr.

     2.3. Use the Xor16 gate and HalfAddr circuit to build the Full Binary Adder circuit: FullAdder.

     2.4. Use the HalfAddr and FullAddr circuits to build the 16-bits two binary numbers Adder circuit: Addr16.

  3. Build the 16K RAM Component:

     3.1. Build the 1-bit register: Bit.

     3.2. Build the 16-bit register: Register.

     3.3. Build the 16-bits Program Counter register: PC, using Inc16 and a multiplexer gate.

     3.4. Build the 8-registers RAM: RAM8, using 8 Register components with some Mux(es) and DMux(es).

     3.5. Build the 64-registers RAM: RAM64, using 8 RAM8 components with some Mux(es) and DMux(es).

     3.6. Build the 512-registers RAM: RAM512 component, from the same principles.

     3.7. Build the 4K-registers RAM: RAM4K.

     3.8. Build the 16K-registers RAM: RAM16K.

  4. Build the Computer:

     4.1. Build the Memory component: Memory, using up the RAM16K, Screen and Keyboard components.

     4.2. Build the CPU component: CPU, using the ARegister, DRegister, ALU and PC components with some other logic gates.

     4.3. Build the Computer master component: Computer, using the Memory, CPU and ROM32K components.

During this first part course and the accompanying chapters I was taught the Hack Machine Language (16-bit Binary Instructions) and the designed 16-bits Hack Assembly Language, which was a very min-opening experience to see how machine code and assembly language get designed according to an architecture one would build.

All I can say is that it was a very good and mind-opening experience, it definitely made me realize a lot of intrinsic details regarding the Hardware-Software interface, how hardware gets designed and how Assemblers generally work. The book and the course are totally recommended!

Last but not least, I have open-sourced the Assembler's source code on my GitHub account, go check it out at [Assembler.hack @GitHub](https://github.com/aalhour/Assembler.hack), and feel free to comment on it and add to if you feel like!
